mod mcp;
mod probe;
mod security;
mod state;
mod tools;

use mcp::{McpServerConfig, McpServerStatus, McpToolInfo};
use probe::{
    execute_proxy_http, probe_openclaw, scan_all_local_llms, LocalLlmEndpoint, OpenClawProbeResult,
    ProxyHttpRequest, ProxyHttpResponse,
};
use security::{ApprovalChallenge, ApprovalGrant, AuditEntry, SecurityPolicy, ToolCategory};
use serde_json::Value;
use state::AppState;
use tauri::State;
use tools::{run_local_tool, ToolExecResult};

#[tauri::command]
fn get_security_policy(state: State<'_, AppState>) -> Result<SecurityPolicy, String> {
    state
        .policy
        .lock()
        .map(|p| p.clone())
        .map_err(|_| "Policy lock poisoned".to_string())
}

#[tauri::command]
fn update_security_policy(
    state: State<'_, AppState>,
    policy: SecurityPolicy,
) -> Result<SecurityPolicy, String> {
    state.save_policy(&policy)?;
    let mut guard = state
        .policy
        .lock()
        .map_err(|_| "Policy lock poisoned".to_string())?;
    *guard = policy.clone();
    Ok(policy)
}

#[tauri::command]
fn get_audit_log(state: State<'_, AppState>) -> Result<Vec<AuditEntry>, String> {
    state
        .audit_log
        .lock()
        .map(|log| log.clone())
        .map_err(|_| "Audit lock poisoned".to_string())
}

#[tauri::command]
fn clear_audit_log(state: State<'_, AppState>) -> Result<(), String> {
    let mut log = state
        .audit_log
        .lock()
        .map_err(|_| "Audit lock poisoned".to_string())?;
    log.clear();
    Ok(())
}

#[tauri::command]
async fn scan_local_llms() -> Vec<LocalLlmEndpoint> {
    scan_all_local_llms().await
}

#[tauri::command]
async fn probe_openclaw_gateway(ws_url: String) -> OpenClawProbeResult {
    probe_openclaw(&ws_url).await
}

#[tauri::command]
fn request_tool_approval(
    state: State<'_, AppState>,
    tool_name: String,
    category: ToolCategory,
    summary: String,
    args: Value,
) -> Result<ApprovalChallenge, String> {
    let mut store = state
        .approvals
        .lock()
        .map_err(|_| "Approval lock poisoned".to_string())?;
    Ok(store.create_challenge(&tool_name, category, summary, &args))
}

#[tauri::command]
fn approve_tool_request(
    state: State<'_, AppState>,
    approval_id: String,
) -> Result<ApprovalGrant, String> {
    let mut store = state
        .approvals
        .lock()
        .map_err(|_| "Approval lock poisoned".to_string())?;
    store.approve(&approval_id)
}

#[tauri::command]
fn deny_tool_request(state: State<'_, AppState>, approval_id: String) -> Result<(), String> {
    let mut store = state
        .approvals
        .lock()
        .map_err(|_| "Approval lock poisoned".to_string())?;
    store.deny(&approval_id);
    Ok(())
}

#[tauri::command]
async fn execute_local_tool(
    state: State<'_, AppState>,
    tool_name: String,
    args: Value,
    approval_token: Option<String>,
) -> Result<ToolExecResult, String> {
    run_local_tool(&state, &tool_name, &args, approval_token.as_deref()).await
}

#[tauri::command]
async fn proxy_http(req: ProxyHttpRequest) -> Result<ProxyHttpResponse, String> {
    execute_proxy_http(req).await
}

#[tauri::command]
fn get_mcp_servers(state: State<'_, AppState>) -> Result<Vec<McpServerConfig>, String> {
    state
        .mcp_configs
        .lock()
        .map(|c| c.clone())
        .map_err(|_| "MCP config lock poisoned".to_string())
}

#[tauri::command]
fn save_mcp_servers(
    state: State<'_, AppState>,
    servers: Vec<McpServerConfig>,
) -> Result<Vec<McpServerConfig>, String> {
    state.save_mcp_configs(&servers)?;
    let mut guard = state
        .mcp_configs
        .lock()
        .map_err(|_| "MCP config lock poisoned".to_string())?;
    *guard = servers.clone();
    Ok(servers)
}

#[tauri::command]
async fn mcp_connect_server(
    state: State<'_, AppState>,
    config: McpServerConfig,
) -> Result<McpServerStatus, String> {
    state.mcp_manager.connect(config).await
}

#[tauri::command]
async fn mcp_disconnect_server(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<(), String> {
    state.mcp_manager.disconnect(&server_id).await;
    Ok(())
}

#[tauri::command]
async fn mcp_list_statuses(state: State<'_, AppState>) -> Result<Vec<McpServerStatus>, String> {
    let configs = state
        .mcp_configs
        .lock()
        .map(|c| c.clone())
        .map_err(|_| "MCP config lock poisoned".to_string())?;
    Ok(state.mcp_manager.list_statuses(&configs).await)
}

#[tauri::command]
async fn mcp_list_tools(state: State<'_, AppState>) -> Result<Vec<McpToolInfo>, String> {
    Ok(state.mcp_manager.list_all_tools().await)
}

#[tauri::command]
async fn mcp_call_tool(
    state: State<'_, AppState>,
    server_id: String,
    tool_name: String,
    args: Value,
    approval_token: Option<String>,
) -> Result<ToolExecResult, String> {
    state
        .mcp_manager
        .call_tool(&state, &server_id, &tool_name, &args, approval_token.as_deref())
        .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::load_or_default())
        .invoke_handler(tauri::generate_handler![
            get_security_policy,
            update_security_policy,
            get_audit_log,
            clear_audit_log,
            scan_local_llms,
            probe_openclaw_gateway,
            request_tool_approval,
            approve_tool_request,
            deny_tool_request,
            execute_local_tool,
            proxy_http,
            get_mcp_servers,
            save_mcp_servers,
            mcp_connect_server,
            mcp_disconnect_server,
            mcp_list_statuses,
            mcp_list_tools,
            mcp_call_tool,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cage application");
}
