use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeRequest {
  /// OAuth scopes to request. When empty the Android side defaults to
  /// `drive.appdata`.
  pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeResponse {
  /// Short-lived Google access token carrying the requested scopes.
  pub access_token: String,
}
