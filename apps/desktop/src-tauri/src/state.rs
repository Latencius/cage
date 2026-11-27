use crate::security::{ApprovalStore, AuditEntry, SecurityPolicy};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub policy: Mutex<SecurityPolicy>,
    pub approvals: Mutex<ApprovalStore>,
    pub audit_log: Mutex<Vec<AuditEntry>>,
    pub config_path: PathBuf,
}

impl AppState {
    pub fn load_or_default() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("cage");
        let _ = fs::create_dir_all(&config_dir);
        let config_path = config_dir.join("policy.json");

        let policy = fs::read_to_string(&config_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<SecurityPolicy>(&raw).ok())
            .unwrap_or_default();

        Self {
            policy: Mutex::new(policy),
            approvals: Mutex::new(ApprovalStore::default()),
            audit_log: Mutex::new(Vec::new()),
            config_path,
        }
    }

    pub fn save_policy(&self, policy: &SecurityPolicy) -> Result<(), String> {
        let json = serde_json::to_string_pretty(policy)
            .map_err(|e| format!("Failed to serialize policy: {}", e))?;
        fs::write(&self.config_path, json)
            .map_err(|e| format!("Failed to persist policy: {}", e))?;
        Ok(())
    }

    pub fn push_audit(&self, entry: AuditEntry) {
        if let Ok(mut log) = self.audit_log.lock() {
            log.push(entry);
            if log.len() > 250 {
                let overflow = log.len() - 250;
                log.drain(0..overflow);
            }
        }
    }
}
