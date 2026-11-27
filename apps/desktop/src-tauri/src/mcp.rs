use crate::security::{AuditEntry, PermissionLevel, ToolCategory};
use crate::state::AppState;
use crate::tools::ToolExecResult;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tokio::time::timeout;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpTransport {
    Stdio,
    Http,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub transport: McpTransport,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
    pub server_id: String,
    pub server_name: String,
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatus {
    pub id: String,
    pub name: String,
    pub transport: McpTransport,
    pub connected: bool,
    pub server_info: Option<String>,
    pub tools: Vec<McpToolInfo>,
    pub error: Option<String>,
}

struct StdioConnection {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

impl StdioConnection {
    async fn send_raw(&mut self, value: &Value) -> Result<(), String> {
        let mut line = serde_json::to_string(value)
            .map_err(|e| format!("Failed to serialize MCP message: {}", e))?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to MCP stdio: {}", e))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush MCP stdio: {}", e))
    }

    async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.next_id += 1;
        let id = self.next_id;
        let req = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        self.send_raw(&req).await?;

        // Read lines until matching JSON-RPC response id arrives (skip server notifications)
        let deadline = Duration::from_secs(20);
        timeout(deadline, async {
            loop {
                let mut line = String::new();
                let n = self
                    .stdout
                    .read_line(&mut line)
                    .await
                    .map_err(|e| format!("Failed to read from MCP stdio: {}", e))?;
                if n == 0 {
                    return Err("MCP server closed stdout unexpectedly".to_string());
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let parsed: Value = match serde_json::from_str(trimmed) {
                    Ok(v) => v,
                    Err(_) => continue, // Ignore stray log lines on stdout
                };
                let resp_id = parsed.get("id").and_then(|v| v.as_u64());
                if resp_id == Some(id) {
                    if let Some(err) = parsed.get("error") {
                        return Err(format!("MCP RPC error ({}): {}", method, err));
                    }
                    return Ok(parsed.get("result").cloned().unwrap_or(Value::Null));
                }
            }
        })
        .await
        .map_err(|_| format!("MCP stdio request '{}' timed out after 20s", method))?
    }

    async fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        let msg = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        self.send_raw(&msg).await
    }

    async fn close(&mut self) {
        let _ = self.child.kill().await;
    }
}

struct HttpConnection {
    url: String,
    headers: HashMap<String, String>,
    session_id: Option<String>,
    client: Client,
    next_id: u64,
}

impl HttpConnection {
    async fn post_json_rpc(&mut self, payload: &Value) -> Result<Option<Value>, String> {
        let mut req = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream");

        if let Some(sid) = &self.session_id {
            req = req.header("Mcp-Session-Id", sid);
        }
        for (k, v) in &self.headers {
            req = req.header(k, v);
        }

        let resp = req
            .body(payload.to_string())
            .send()
            .await
            .map_err(|e| format!("MCP HTTP request failed: {}", e))?;

        if let Some(sid) = resp
            .headers()
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
        {
            self.session_id = Some(sid.to_string());
        }

        let status = resp.status();
        if status.as_u16() == 202 || status.as_u16() == 204 {
            return Ok(None);
        }
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read MCP HTTP response: {}", e))?;
        if !status.is_success() {
            return Err(format!("MCP HTTP error {}: {}", status, body));
        }
        if body.trim().is_empty() {
            return Ok(None);
        }

        // Handle either direct JSON or Server-Sent Events ("data: {...}")
        if let Ok(v) = serde_json::from_str::<Value>(&body) {
            return Ok(Some(v));
        }

        for line in body.lines() {
            if let Some(data) = line.strip_prefix("data:") {
                if let Ok(v) = serde_json::from_str::<Value>(data.trim()) {
                    if v.get("result").is_some() || v.get("error").is_some() {
                        return Ok(Some(v));
                    }
                }
            }
        }

        Err(format!("Unparseable MCP HTTP response: {}", body.chars().take(240).collect::<String>()))
    }

    async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.next_id += 1;
        let payload = json!({
            "jsonrpc": "2.0",
            "id": self.next_id,
            "method": method,
            "params": params,
        });
        let parsed = self
            .post_json_rpc(&payload)
            .await?
            .ok_or_else(|| format!("Empty MCP HTTP response for '{}'", method))?;
        if let Some(err) = parsed.get("error") {
            return Err(format!("MCP HTTP RPC error ({}): {}", method, err));
        }
        Ok(parsed.get("result").cloned().unwrap_or(Value::Null))
    }

    async fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        let _ = self.post_json_rpc(&payload).await;
        Ok(())
    }
}

enum ActiveMcpConn {
    Stdio(StdioConnection),
    Http(HttpConnection),
}

struct ConnectedServer {
    config: McpServerConfig,
    server_info: Option<String>,
    tools: Vec<McpToolInfo>,
    conn: Arc<Mutex<ActiveMcpConn>>,
}

#[derive(Default)]
pub struct McpManager {
    servers: Mutex<HashMap<String, ConnectedServer>>,
}

fn parse_tools_result(server_id: &str, server_name: &str, result: &Value) -> Vec<McpToolInfo> {
    result
        .get("tools")
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let name = item.get("name").and_then(|v| v.as_str())?.to_string();
                    let description = item
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let input_schema = item
                        .get("inputSchema")
                        .cloned()
                        .unwrap_or_else(|| json!({ "type": "object", "properties": {} }));
                    Some(McpToolInfo {
                        server_id: server_id.to_string(),
                        server_name: server_name.to_string(),
                        name,
                        description,
                        input_schema,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn format_server_info(init_result: &Value) -> Option<String> {
    let info = init_result.get("serverInfo")?;
    let name = info.get("name").and_then(|v| v.as_str())?;
    let ver = info.get("version").and_then(|v| v.as_str()).unwrap_or("");
    if ver.is_empty() {
        Some(name.to_string())
    } else {
        Some(format!("{} v{}", name, ver))
    }
}

impl McpManager {
    pub async fn connect(&self, config: McpServerConfig) -> Result<McpServerStatus, String> {
        // Close existing connection with the same id if any
        self.disconnect(&config.id).await;

        let init_params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "Cage",
                "version": "0.2.0"
            }
        });

        let mut active = match config.transport {
            McpTransport::Stdio => {
                let cmd_str = config
                    .command
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| "MCP stdio server requires a command".to_string())?;

                let mut cmd = Command::new(cmd_str);
                if let Some(args) = &config.args {
                    cmd.args(args);
                }
                if let Some(envs) = &config.env {
                    for (k, v) in envs {
                        cmd.env(k, v);
                    }
                }
                cmd.stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null());

                let mut child = cmd
                    .spawn()
                    .map_err(|e| format!("Failed to spawn MCP server '{}': {}", cmd_str, e))?;

                let stdin = child
                    .stdin
                    .take()
                    .ok_or_else(|| "Failed to attach stdin to MCP process".to_string())?;
                let stdout = child
                    .stdout
                    .take()
                    .ok_or_else(|| "Failed to attach stdout to MCP process".to_string())?;

                ActiveMcpConn::Stdio(StdioConnection {
                    child,
                    stdin,
                    stdout: BufReader::new(stdout),
                    next_id: 0,
                })
            }
            McpTransport::Http => {
                let url = config
                    .url
                    .as_deref()
                    .map(str::trim)
                    .filter(|u| u.starts_with("http://") || u.starts_with("https://"))
                    .ok_or_else(|| "MCP HTTP server requires a valid http(s) URL".to_string())?
                    .to_string();

                let client = Client::builder()
                    .timeout(Duration::from_secs(20))
                    .build()
                    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

                ActiveMcpConn::Http(HttpConnection {
                    url,
                    headers: config.headers.clone().unwrap_or_default(),
                    session_id: None,
                    client,
                    next_id: 0,
                })
            }
        };

        let init_res = match &mut active {
            ActiveMcpConn::Stdio(s) => {
                let res = s.request("initialize", init_params).await?;
                s.notify("notifications/initialized", json!({})).await?;
                res
            }
            ActiveMcpConn::Http(h) => {
                let res = h.request("initialize", init_params).await?;
                h.notify("notifications/initialized", json!({})).await?;
                res
            }
        };

        let tools_res = match &mut active {
            ActiveMcpConn::Stdio(s) => s.request("tools/list", json!({})).await?,
            ActiveMcpConn::Http(h) => h.request("tools/list", json!({})).await?,
        };

        let server_info = format_server_info(&init_res);
        let tools = parse_tools_result(&config.id, &config.name, &tools_res);

        let status = McpServerStatus {
            id: config.id.clone(),
            name: config.name.clone(),
            transport: config.transport.clone(),
            connected: true,
            server_info: server_info.clone(),
            tools: tools.clone(),
            error: None,
        };

        let mut guard = self.servers.lock().await;
        guard.insert(
            config.id.clone(),
            ConnectedServer {
                config,
                server_info,
                tools,
                conn: Arc::new(Mutex::new(active)),
            },
        );

        Ok(status)
    }

    pub async fn disconnect(&self, server_id: &str) {
        let removed = {
            let mut guard = self.servers.lock().await;
            guard.remove(server_id)
        };
        if let Some(srv) = removed {
            let mut conn = srv.conn.lock().await;
            if let ActiveMcpConn::Stdio(s) = &mut *conn {
                s.close().await;
            }
        }
    }

    pub async fn list_statuses(&self, configs: &[McpServerConfig]) -> Vec<McpServerStatus> {
        let guard = self.servers.lock().await;
        configs
            .iter()
            .map(|cfg| {
                if let Some(connected) = guard.get(&cfg.id) {
                    McpServerStatus {
                        id: cfg.id.clone(),
                        name: connected.config.name.clone(),
                        transport: connected.config.transport.clone(),
                        connected: true,
                        server_info: connected.server_info.clone(),
                        tools: connected.tools.clone(),
                        error: None,
                    }
                } else {
                    McpServerStatus {
                        id: cfg.id.clone(),
                        name: cfg.name.clone(),
                        transport: cfg.transport.clone(),
                        connected: false,
                        server_info: None,
                        tools: Vec::new(),
                        error: None,
                    }
                }
            })
            .collect()
    }

    pub async fn list_all_tools(&self) -> Vec<McpToolInfo> {
        let guard = self.servers.lock().await;
        guard
            .values()
            .flat_map(|s| s.tools.clone())
            .collect()
    }

    pub async fn call_tool(
        &self,
        state: &AppState,
        server_id: &str,
        tool_name: &str,
        args: &Value,
        approval_token: Option<&str>,
    ) -> Result<ToolExecResult, String> {
        let qualified_name = format!("mcp__{}__{}", server_id, tool_name);
        let policy = state
            .policy
            .lock()
            .map_err(|_| "Policy lock poisoned".to_string())?
            .clone();

        let level = policy.level_for(ToolCategory::McpTool);
        match level {
            PermissionLevel::Deny => {
                state.push_audit(AuditEntry {
                    id: Uuid::new_v4().to_string(),
                    timestamp: Utc::now(),
                    tool_name: qualified_name.clone(),
                    category: ToolCategory::McpTool,
                    decision: "blocked_by_policy".to_string(),
                    summary: format!("Blocked MCP tool '{}' by Deny policy", qualified_name),
                    ok: false,
                });
                return Err(format!(
                    "MCP tool '{}' is disabled in Safety Settings (Deny).",
                    qualified_name
                ));
            }
            PermissionLevel::RequireApproval => {
                let token = approval_token.ok_or_else(|| {
                    format!(
                        "Approval token required before calling MCP tool '{}'",
                        qualified_name
                    )
                })?;
                let mut store = state
                    .approvals
                    .lock()
                    .map_err(|_| "Approval lock poisoned".to_string())?;
                if let Err(err) = store.consume_token(token, &qualified_name, args) {
                    state.push_audit(AuditEntry {
                        id: Uuid::new_v4().to_string(),
                        timestamp: Utc::now(),
                        tool_name: qualified_name.clone(),
                        category: ToolCategory::McpTool,
                        decision: "invalid_token".to_string(),
                        summary: err.clone(),
                        ok: false,
                    });
                    return Err(err);
                }
            }
            PermissionLevel::AutoAllow => {}
        }

        let conn_arc = {
            let guard = self.servers.lock().await;
            guard
                .get(server_id)
                .map(|s| Arc::clone(&s.conn))
                .ok_or_else(|| format!("MCP server '{}' is not connected", server_id))?
        };

        let call_params = json!({
            "name": tool_name,
            "arguments": args,
        });

        let rpc_res = {
            let mut conn = conn_arc.lock().await;
            match &mut *conn {
                ActiveMcpConn::Stdio(s) => s.request("tools/call", call_params).await,
                ActiveMcpConn::Http(h) => h.request("tools/call", call_params).await,
            }
        };

        let decision = if level == PermissionLevel::RequireApproval {
            "approved_and_executed"
        } else {
            "auto_allowed"
        };

        let exec_result = match rpc_res {
            Ok(result_val) => {
                let is_error = result_val
                    .get("isError")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let mut chunks = Vec::new();
                if let Some(arr) = result_val.get("content").and_then(|c| c.as_array()) {
                    for item in arr {
                        if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                            chunks.push(text.to_string());
                        } else {
                            chunks.push(item.to_string());
                        }
                    }
                } else {
                    chunks.push(result_val.to_string());
                }
                let mut output = chunks.join("\n");
                let mut truncated = false;
                if output.len() > 24_000 {
                    output.truncate(24_000);
                    output.push_str("\n...[truncated]");
                    truncated = true;
                }
                Ok(ToolExecResult {
                    ok: !is_error,
                    output,
                    truncated,
                })
            }
            Err(err) => Err(err),
        };

        state.push_audit(AuditEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            tool_name: qualified_name,
            category: ToolCategory::McpTool,
            decision: decision.to_string(),
            summary: match &exec_result {
                Ok(r) => format!("MCP call {} (ok={})", tool_name, r.ok),
                Err(e) => format!("MCP call {} failed: {}", tool_name, e),
            },
            ok: exec_result.as_ref().map(|r| r.ok).unwrap_or(false),
        });

        exec_result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::SecurityPolicy;

    #[tokio::test]
    async fn stdio_mcp_handshake_and_approval_boundary() {
        // Real minimal JSON-RPC 2.0 MCP server in python3 over stdio
        let script = r#"
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    msg = json.loads(line)
    mid = msg.get("id")
    method = msg.get("method")
    if method == "initialize":
        resp = {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "cage-test-mcp", "version": "1.0.0"}
            }
        }
        print(json.dumps(resp), flush=True)
    elif method == "tools/list":
        resp = {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "tools": [{
                    "name": "add_numbers",
                    "description": "Add two integers",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
                        "required": ["a", "b"]
                    }
                }]
            }
        }
        print(json.dumps(resp), flush=True)
    elif method == "tools/call":
        args = msg["params"]["arguments"]
        total = args["a"] + args["b"]
        resp = {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "content": [{"type": "text", "text": f"sum={total}"}],
                "isError": False
            }
        }
        print(json.dumps(resp), flush=True)
"#;

        let manager = McpManager::default();
        let cfg = McpServerConfig {
            id: "math".to_string(),
            name: "Math MCP".to_string(),
            transport: McpTransport::Stdio,
            command: Some("python3".to_string()),
            args: Some(vec!["-u".to_string(), "-c".to_string(), script.to_string()]),
            env: None,
            url: None,
            headers: None,
            enabled: true,
        };

        let status = manager.connect(cfg).await.expect("connect stdio MCP");
        assert!(status.connected);
        assert_eq!(status.server_info.as_deref(), Some("cage-test-mcp v1.0.0"));
        assert_eq!(status.tools.len(), 1);
        assert_eq!(status.tools[0].name, "add_numbers");

        let state = AppState::for_test(SecurityPolicy::default());
        let args = json!({ "a": 17, "b": 25 });

        // Must fail without approval token (McpTool defaults to RequireApproval)
        let denied = manager
            .call_tool(&state, "math", "add_numbers", &args, None)
            .await;
        assert!(denied.is_err());

        // Mint one-time approval token for qualified MCP tool name
        let grant = {
            let mut store = state.approvals.lock().unwrap();
            let ch = store.create_challenge(
                "mcp__math__add_numbers",
                ToolCategory::McpTool,
                "Add numbers".to_string(),
                &args,
            );
            store.approve(&ch.approval_id).unwrap()
        };

        let result = manager
            .call_tool(
                &state,
                "math",
                "add_numbers",
                &args,
                Some(&grant.approval_token),
            )
            .await
            .expect("approved MCP tool call");
        assert!(result.ok);
        assert_eq!(result.output, "sum=42");

        // Replay with same token must fail
        let replay = manager
            .call_tool(
                &state,
                "math",
                "add_numbers",
                &args,
                Some(&grant.approval_token),
            )
            .await;
        assert!(replay.is_err());

        manager.disconnect("math").await;
    }
}
