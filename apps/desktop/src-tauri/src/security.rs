use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionLevel {
    AutoAllow,
    RequireApproval,
    Deny,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    FsRead,
    FsWrite,
    FsDelete,
    ShellExec,
    WebFetch,
    VmControl,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    Local,
    IsolatedVm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityPolicy {
    pub allowed_dirs: Vec<String>,
    pub permissions: HashMap<ToolCategory, PermissionLevel>,
    pub execution_mode: ExecutionMode,
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        let mut permissions = HashMap::new();
        permissions.insert(ToolCategory::FsRead, PermissionLevel::AutoAllow);
        permissions.insert(ToolCategory::FsWrite, PermissionLevel::RequireApproval);
        permissions.insert(ToolCategory::FsDelete, PermissionLevel::RequireApproval);
        permissions.insert(ToolCategory::ShellExec, PermissionLevel::RequireApproval);
        permissions.insert(ToolCategory::WebFetch, PermissionLevel::AutoAllow);
        permissions.insert(ToolCategory::VmControl, PermissionLevel::RequireApproval);

        Self {
            allowed_dirs: Vec::new(),
            permissions,
            execution_mode: ExecutionMode::Local,
        }
    }
}

impl SecurityPolicy {
    pub fn level_for(&self, category: ToolCategory) -> PermissionLevel {
        self.permissions
            .get(&category)
            .copied()
            .unwrap_or(PermissionLevel::Deny)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub tool_name: String,
    pub category: ToolCategory,
    pub decision: String,
    pub summary: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalChallenge {
    pub approval_id: String,
    pub tool_name: String,
    pub category: ToolCategory,
    pub summary: String,
    pub args_hash: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalGrant {
    pub approval_id: String,
    pub approval_token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct PendingApproval {
    tool_name: String,
    args_hash: String,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct GrantedToken {
    tool_name: String,
    args_hash: String,
    expires_at: DateTime<Utc>,
}

#[derive(Default)]
pub struct ApprovalStore {
    pending: HashMap<String, PendingApproval>,
    granted: HashMap<String, GrantedToken>,
}

pub fn hash_args(tool_name: &str, args_canonical: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(tool_name.as_bytes());
    hasher.update(b":");
    hasher.update(args_canonical.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn canonical_json(value: &serde_json::Value) -> String {
    fn sort_value(v: &serde_json::Value) -> serde_json::Value {
        match v {
            serde_json::Value::Object(map) => {
                let mut keys: Vec<&String> = map.keys().collect();
                keys.sort();
                let mut sorted = serde_json::Map::new();
                for k in keys {
                    sorted.insert(k.clone(), sort_value(&map[k]));
                }
                serde_json::Value::Object(sorted)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.iter().map(sort_value).collect())
            }
            other => other.clone(),
        }
    }
    serde_json::to_string(&sort_value(value)).unwrap_or_default()
}

impl ApprovalStore {
    fn prune_expired(&mut self) {
        let now = Utc::now();
        self.pending.retain(|_, v| v.expires_at > now);
        self.granted.retain(|_, v| v.expires_at > now);
    }

    pub fn create_challenge(
        &mut self,
        tool_name: &str,
        category: ToolCategory,
        summary: String,
        args: &serde_json::Value,
    ) -> ApprovalChallenge {
        self.prune_expired();
        let approval_id = Uuid::new_v4().to_string();
        let args_hash = hash_args(tool_name, &canonical_json(args));
        let expires_at = Utc::now() + Duration::minutes(5);
        self.pending.insert(
            approval_id.clone(),
            PendingApproval {
                tool_name: tool_name.to_string(),
                args_hash: args_hash.clone(),
                expires_at,
            },
        );
        ApprovalChallenge {
            approval_id,
            tool_name: tool_name.to_string(),
            category,
            summary,
            args_hash,
            expires_at,
        }
    }

    pub fn approve(&mut self, approval_id: &str) -> Result<ApprovalGrant, String> {
        self.prune_expired();
        let pending = self
            .pending
            .remove(approval_id)
            .ok_or_else(|| "Approval request not found or expired".to_string())?;
        let token = format!("cage_grant_{}", Uuid::new_v4());
        let expires_at = Utc::now() + Duration::minutes(2);
        self.granted.insert(
            token.clone(),
            GrantedToken {
                tool_name: pending.tool_name,
                args_hash: pending.args_hash,
                expires_at,
            },
        );
        Ok(ApprovalGrant {
            approval_id: approval_id.to_string(),
            approval_token: token,
            expires_at,
        })
    }

    pub fn deny(&mut self, approval_id: &str) {
        self.pending.remove(approval_id);
    }

    pub fn consume_token(
        &mut self,
        token: &str,
        tool_name: &str,
        args: &serde_json::Value,
    ) -> Result<(), String> {
        self.prune_expired();
        let granted = self
            .granted
            .remove(token)
            .ok_or_else(|| "Missing, invalid, or already-used approval token".to_string())?;

        if granted.tool_name != tool_name {
            return Err("Approval token tool mismatch".to_string());
        }

        let actual_hash = hash_args(tool_name, &canonical_json(args));
        if granted.args_hash != actual_hash {
            return Err("Approval token argument tamper detected".to_string());
        }

        Ok(())
    }
}

/// Resolve and verify that `raw_path` is strictly inside one of `allowed_dirs`.
/// Blocks `..` traversal and symlink escapes.
pub fn resolve_safe_path(raw_path: &str, allowed_dirs: &[String]) -> Result<PathBuf, String> {
    if allowed_dirs.is_empty() {
        return Err(
            "No allowed folders configured. Add a workspace folder in Safety Settings first."
                .to_string(),
        );
    }

    let canonical_roots: Vec<PathBuf> = allowed_dirs
        .iter()
        .filter_map(|d| fs::canonicalize(d).ok())
        .collect();

    if canonical_roots.is_empty() {
        return Err("None of the configured allowed folders exist on disk.".to_string());
    }

    let input = Path::new(raw_path);
    let candidate = if input.is_absolute() {
        input.to_path_buf()
    } else {
        canonical_roots[0].join(input)
    };

    let resolved = if candidate.exists() {
        fs::canonicalize(&candidate)
            .map_err(|e| format!("Failed to resolve path '{}': {}", raw_path, e))?
    } else {
        // Walk up to nearest existing ancestor and verify remaining components contain no `..`
        let mut ancestor = candidate.as_path();
        let mut tail: Vec<std::ffi::OsString> = Vec::new();
        while !ancestor.exists() {
            let name = ancestor
                .file_name()
                .ok_or_else(|| format!("Invalid target path '{}'", raw_path))?;
            tail.push(name.to_os_string());
            ancestor = ancestor
                .parent()
                .ok_or_else(|| format!("Invalid parent path '{}'", raw_path))?;
        }
        let mut base = fs::canonicalize(ancestor)
            .map_err(|e| format!("Failed to resolve ancestor for '{}': {}", raw_path, e))?;
        for seg in tail.into_iter().rev() {
            let seg_path = Path::new(&seg);
            for comp in seg_path.components() {
                match comp {
                    Component::Normal(part) => base.push(part),
                    _ => return Err("Path traversal segments are forbidden".to_string()),
                }
            }
        }
        base
    };

    if canonical_roots.iter().any(|root| resolved.starts_with(root)) {
        Ok(resolved)
    } else {
        Err(format!(
            "Security boundary blocked access outside allowed folders: {}",
            resolved.display()
        ))
    }
}

/// Hard-block catastrophic shell patterns even if approved, to prevent accidental OS destruction.
pub fn validate_shell_command(command: &str) -> Result<(), String> {
    let lower = command.to_lowercase();
    let blocked_patterns = [
        "rm -rf /",
        "rm -fr /",
        "rm -rf /*",
        "rm -rf ~",
        "mkfs.",
        "dd if=",
        ":(){:|:&};:",
        "shutdown",
        "reboot",
        "diskutil erase",
        "sudo ",
    ];

    for pat in blocked_patterns {
        if lower.contains(pat) {
            return Err(format!(
                "Hard safety guard blocked dangerous shell pattern: '{}'",
                pat.trim()
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn blocks_when_no_allowed_dirs() {
        let res = resolve_safe_path("/tmp/test.txt", &[]);
        assert!(res.is_err());
    }

    #[test]
    fn allows_file_inside_allowed_dir_and_blocks_traversal() {
        let dir = tempdir().unwrap();
        let allowed = vec![dir.path().to_string_lossy().to_string()];

        let ok_file = dir.path().join("notes.txt");
        fs::write(&ok_file, "hello").unwrap();
        assert!(resolve_safe_path(ok_file.to_str().unwrap(), &allowed).is_ok());

        let new_file = dir.path().join("sub/new.md");
        assert!(resolve_safe_path(new_file.to_str().unwrap(), &allowed).is_ok());

        let escape = format!("{}/../../etc/passwd", dir.path().display());
        assert!(resolve_safe_path(&escape, &allowed).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn blocks_symlink_escape() {
        use std::os::unix::fs::symlink;
        let allowed_dir = tempdir().unwrap();
        let outside_dir = tempdir().unwrap();
        let secret = outside_dir.path().join("secret.txt");
        fs::write(&secret, "top-secret").unwrap();

        let link = allowed_dir.path().join("link.txt");
        symlink(&secret, &link).unwrap();

        let allowed = vec![allowed_dir.path().to_string_lossy().to_string()];
        assert!(resolve_safe_path(link.to_str().unwrap(), &allowed).is_err());
    }

    #[test]
    fn approval_token_is_single_use_and_tamper_evident() {
        let mut store = ApprovalStore::default();
        let args = json!({ "path": "a.txt", "content": "hi" });
        let challenge = store.create_challenge(
            "write_file",
            ToolCategory::FsWrite,
            "Write a.txt".into(),
            &args,
        );
        let grant = store.approve(&challenge.approval_id).unwrap();

        // Tampered args fail and consume token
        let tampered = json!({ "path": "b.txt", "content": "evil" });
        assert!(store
            .consume_token(&grant.approval_token, "write_file", &tampered)
            .is_err());

        // Re-issue for valid test
        let challenge2 = store.create_challenge(
            "write_file",
            ToolCategory::FsWrite,
            "Write a.txt".into(),
            &args,
        );
        let grant2 = store.approve(&challenge2.approval_id).unwrap();
        assert!(store
            .consume_token(&grant2.approval_token, "write_file", &args)
            .is_ok());
        // Replay fails
        assert!(store
            .consume_token(&grant2.approval_token, "write_file", &args)
            .is_err());
    }

    #[test]
    fn blocks_catastrophic_shell_commands() {
        assert!(validate_shell_command("ls -la").is_ok());
        assert!(validate_shell_command("rm -rf /").is_err());
        assert!(validate_shell_command("sudo rm -rf /tmp/foo").is_err());
    }
}
