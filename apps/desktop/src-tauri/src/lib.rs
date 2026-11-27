mod probe;
mod security;
mod state;
mod tools;

use probe::{execute_proxy_http, scan_all_local_llms, LocalLlmEndpoint, ProxyHttpRequest, ProxyHttpResponse};
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
            request_tool_approval,
            approve_tool_request,
            deny_tool_request,
            execute_local_tool,
            proxy_http,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cage application");
}
