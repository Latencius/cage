use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmEndpoint {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub online: bool,
    pub models: Vec<String>,
    pub latency_ms: Option<u64>,
}

struct ProbeTarget {
    id: &'static str,
    name: &'static str,
    base_url: &'static str,
    models_url: &'static str,
    is_ollama_tags: bool,
}

const TARGETS: &[ProbeTarget] = &[
    ProbeTarget {
        id: "ollama",
        name: "Ollama",
        base_url: "http://127.0.0.1:11434/v1",
        models_url: "http://127.0.0.1:11434/api/tags",
        is_ollama_tags: true,
    },
    ProbeTarget {
        id: "lmstudio",
        name: "LM Studio",
        base_url: "http://127.0.0.1:1234/v1",
        models_url: "http://127.0.0.1:1234/v1/models",
        is_ollama_tags: false,
    },
    ProbeTarget {
        id: "llamacpp",
        name: "llama.cpp Server",
        base_url: "http://127.0.0.1:8080/v1",
        models_url: "http://127.0.0.1:8080/v1/models",
        is_ollama_tags: false,
    },
    ProbeTarget {
        id: "vllm",
        name: "vLLM / LocalAI",
        base_url: "http://127.0.0.1:8000/v1",
        models_url: "http://127.0.0.1:8000/v1/models",
        is_ollama_tags: false,
    },
];

pub async fn scan_all_local_llms() -> Vec<LocalLlmEndpoint> {
    let client = Client::builder()
        .timeout(Duration::from_millis(1200))
        .build()
        .unwrap_or_else(|_| Client::new());

    let mut handles = Vec::new();
    for target in TARGETS {
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            let start = std::time::Instant::now();
            match client.get(target.models_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let latency = start.elapsed().as_millis() as u64;
                    let models = match resp.json::<serde_json::Value>().await {
                        Ok(json) => {
                            if target.is_ollama_tags {
                                json.get("models")
                                    .and_then(|m| m.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|item| {
                                                item.get("name")
                                                    .and_then(|v| v.as_str())
                                                    .map(String::from)
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_default()
                            } else {
                                json.get("data")
                                    .and_then(|d| d.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|item| {
                                                item.get("id")
                                                    .and_then(|v| v.as_str())
                                                    .map(String::from)
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_default()
                            }
                        }
                        Err(_) => Vec::new(),
                    };

                    LocalLlmEndpoint {
                        id: target.id.to_string(),
                        name: target.name.to_string(),
                        base_url: target.base_url.to_string(),
                        online: true,
                        models,
                        latency_ms: Some(latency),
                    }
                }
                _ => LocalLlmEndpoint {
                    id: target.id.to_string(),
                    name: target.name.to_string(),
                    base_url: target.base_url.to_string(),
                    online: false,
                    models: Vec::new(),
                    latency_ms: None,
                },
            }
        }));
    }

    let mut results = Vec::new();
    for h in handles {
        if let Ok(ep) = h.await {
            results.push(ep);
        }
    }
    results
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyHttpRequest {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyHttpResponse {
    pub status: u16,
    pub ok: bool,
    pub body: String,
}

pub async fn execute_proxy_http(req: ProxyHttpRequest) -> Result<ProxyHttpResponse, String> {
    let url = req.url.trim();
    if !(url.starts_with("http://127.0.0.1")
        || url.starts_with("http://localhost")
        || url.starts_with("https://"))
    {
        return Err("Proxy only permits localhost HTTP or remote HTTPS URLs".to_string());
    }

    let timeout = Duration::from_millis(req.timeout_ms.unwrap_or(60_000).min(120_000));
    let client = Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let method = reqwest::Method::from_bytes(req.method.to_uppercase().as_bytes())
        .map_err(|_| format!("Invalid HTTP method: {}", req.method))?;

    let mut builder = client.request(method, url);
    if let Some(headers) = req.headers {
        for (k, v) in headers {
            builder = builder.header(&k, &v);
        }
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let resp = builder
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(ProxyHttpResponse { status, ok, body })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawProbeResult {
    pub ws_url: String,
    pub http_url: String,
    pub reachable: bool,
    pub latency_ms: Option<u64>,
    pub detail: String,
}

pub async fn probe_openclaw(ws_url: &str) -> OpenClawProbeResult {
    let trimmed = ws_url.trim();
    let http_url = if let Some(rest) = trimmed.strip_prefix("wss://") {
        format!("https://{}", rest)
    } else if let Some(rest) = trimmed.strip_prefix("ws://") {
        format!("http://{}", rest)
    } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{}", trimmed)
    };

    let client = Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
        .unwrap_or_else(|_| Client::new());

    let start = std::time::Instant::now();
    match client.get(&http_url).send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            OpenClawProbeResult {
                ws_url: trimmed.to_string(),
                http_url,
                reachable: true,
                latency_ms: Some(latency),
                detail: format!("Gateway HTTP responded ({})", resp.status()),
            }
        }
        Err(e) => OpenClawProbeResult {
            ws_url: trimmed.to_string(),
            http_url,
            reachable: false,
            latency_ms: None,
            detail: format!("Unreachable: {}", e),
        },
    }
}
