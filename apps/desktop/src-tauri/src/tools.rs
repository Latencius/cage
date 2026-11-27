use crate::security::{
    resolve_safe_path, validate_shell_command, AuditEntry, PermissionLevel, ToolCategory,
};
use crate::state::AppState;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolExecResult {
    pub ok: bool,
    pub output: String,
    pub truncated: bool,
}

pub fn category_for_tool(tool_name: &str) -> Result<ToolCategory, String> {
    match tool_name {
        "list_dir" | "read_file" => Ok(ToolCategory::FsRead),
        "write_file" | "move_file" => Ok(ToolCategory::FsWrite),
        "delete_file" => Ok(ToolCategory::FsDelete),
        "run_shell" => Ok(ToolCategory::ShellExec),
        "fetch_url" => Ok(ToolCategory::WebFetch),
        _ => Err(format!("Unknown local tool: {}", tool_name)),
    }
}

pub async fn run_local_tool(
    state: &AppState,
    tool_name: &str,
    args: &Value,
    approval_token: Option<&str>,
) -> Result<ToolExecResult, String> {
    let category = category_for_tool(tool_name)?;
    let policy = state
        .policy
        .lock()
        .map_err(|_| "Policy lock poisoned".to_string())?
        .clone();

    let level = policy.level_for(category);
    match level {
        PermissionLevel::Deny => {
            state.push_audit(AuditEntry {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                tool_name: tool_name.to_string(),
                category,
                decision: "blocked_by_policy".to_string(),
                summary: format!("Blocked '{}' by Deny policy", tool_name),
                ok: false,
            });
            return Err(format!(
                "Tool '{}' is disabled in Safety Settings (Deny).",
                tool_name
            ));
        }
        PermissionLevel::RequireApproval => {
            let token = approval_token.ok_or_else(|| {
                format!(
                    "Approval token required before executing '{}'",
                    tool_name
                )
            })?;
            let mut store = state
                .approvals
                .lock()
                .map_err(|_| "Approval lock poisoned".to_string())?;
            if let Err(err) = store.consume_token(token, tool_name, args) {
                state.push_audit(AuditEntry {
                    id: Uuid::new_v4().to_string(),
                    timestamp: Utc::now(),
                    tool_name: tool_name.to_string(),
                    category,
                    decision: "invalid_token".to_string(),
                    summary: err.clone(),
                    ok: false,
                });
                return Err(err);
            }
        }
        PermissionLevel::AutoAllow => {}
    }

    let result = match tool_name {
        "list_dir" => exec_list_dir(args, &policy.allowed_dirs),
        "read_file" => exec_read_file(args, &policy.allowed_dirs),
        "write_file" => exec_write_file(args, &policy.allowed_dirs),
        "delete_file" => exec_delete_file(args, &policy.allowed_dirs),
        "move_file" => exec_move_file(args, &policy.allowed_dirs),
        "run_shell" => exec_run_shell(args, &policy.allowed_dirs).await,
        "fetch_url" => exec_fetch_url(args).await,
        _ => Err(format!("Unsupported tool: {}", tool_name)),
    };

    let decision = if level == PermissionLevel::RequireApproval {
        "approved_and_executed"
    } else {
        "auto_allowed"
    };

    state.push_audit(AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        tool_name: tool_name.to_string(),
        category,
        decision: decision.to_string(),
        summary: match &result {
            Ok(_) => format!("Executed {} successfully", tool_name),
            Err(e) => format!("{} failed: {}", tool_name, e),
        },
        ok: result.is_ok(),
    });

    result
}

fn str_arg<'a>(args: &'a Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Missing required string argument '{}'", key))
}

fn truncate_output(mut s: String, limit: usize) -> ToolExecResult {
    if s.len() > limit {
        s.truncate(limit);
        s.push_str("\n...[truncated]");
        ToolExecResult {
            ok: true,
            output: s,
            truncated: true,
        }
    } else {
        ToolExecResult {
            ok: true,
            output: s,
            truncated: false,
        }
    }
}

fn exec_list_dir(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let raw = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let path = resolve_safe_path(raw, allowed_dirs)?;
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to list '{}': {}", path.display(), e))?;

    let mut lines = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        let kind = if meta.as_ref().map(|m| m.is_dir()).unwrap_or(false) {
            "DIR "
        } else {
            "FILE"
        };
        let size = meta.map(|m| m.len()).unwrap_or(0);
        lines.push(format!("[{}] {} ({} bytes)", kind, name, size));
    }
    lines.sort();
    Ok(truncate_output(
        format!("Directory: {}\n{}", path.display(), lines.join("\n")),
        16_000,
    ))
}

fn exec_read_file(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let raw = str_arg(args, "path")?;
    let path = resolve_safe_path(raw, allowed_dirs)?;
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read '{}': {}", path.display(), e))?;
    Ok(truncate_output(content, 24_000))
}

fn exec_write_file(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let raw = str_arg(args, "path")?;
    let content = str_arg(args, "content")?;
    let path = resolve_safe_path(raw, allowed_dirs)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write '{}': {}", path.display(), e))?;
    Ok(ToolExecResult {
        ok: true,
        output: format!("Wrote {} bytes to {}", content.len(), path.display()),
        truncated: false,
    })
}

fn exec_delete_file(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let raw = str_arg(args, "path")?;
    let path = resolve_safe_path(raw, allowed_dirs)?;
    if path.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete directory '{}': {}", path.display(), e))?;
    } else {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file '{}': {}", path.display(), e))?;
    }
    Ok(ToolExecResult {
        ok: true,
        output: format!("Deleted {}", path.display()),
        truncated: false,
    })
}

fn exec_move_file(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let from_raw = str_arg(args, "from")?;
    let to_raw = str_arg(args, "to")?;
    let from = resolve_safe_path(from_raw, allowed_dirs)?;
    let to = resolve_safe_path(to_raw, allowed_dirs)?;
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create target dir: {}", e))?;
    }
    fs::rename(&from, &to)
        .map_err(|e| format!("Failed to move '{}' -> '{}': {}", from.display(), to.display(), e))?;
    Ok(ToolExecResult {
        ok: true,
        output: format!("Moved {} -> {}", from.display(), to.display()),
        truncated: false,
    })
}

async fn exec_run_shell(args: &Value, allowed_dirs: &[String]) -> Result<ToolExecResult, String> {
    let command = str_arg(args, "command")?;
    validate_shell_command(command)?;

    let cwd_raw = args.get("cwd").and_then(|v| v.as_str()).unwrap_or(".");
    let cwd = resolve_safe_path(cwd_raw, allowed_dirs)?;

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("powershell");
        c.args(["-NoProfile", "-Command", command]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("sh");
        c.args(["-c", command]);
        c
    };

    cmd.current_dir(&cwd);

    let out = timeout(Duration::from_secs(30), cmd.output())
        .await
        .map_err(|_| "Command timed out after 30 seconds".to_string())?
        .map_err(|e| format!("Failed to spawn shell command: {}", e))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = format!(
        "exit_code: {}\nstdout:\n{}\nstderr:\n{}",
        out.status.code().unwrap_or(-1),
        stdout,
        stderr
    );
    Ok(truncate_output(combined, 16_000))
}

async fn exec_fetch_url(args: &Value) -> Result<ToolExecResult, String> {
    let url = str_arg(args, "url")?;
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL must start with http:// or https://".to_string());
    }
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("CageAgent/0.1")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Fetch failed: {}", e))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    Ok(truncate_output(format!("HTTP {}\n{}", status, text), 16_000))
}
