package ca.dovall.mytronome.plugin.drive

import android.app.Activity
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope

@InvokeArg
class AuthorizeArgs {
    // OAuth scopes to request; defaults to Drive's app-data folder scope.
    var scopes: List<String>? = null
}

/**
 * Native Google Drive authorization via the Identity Services Authorization API.
 *
 * `authorize` requests the given scopes. If the user has already granted them, an
 * access token comes back immediately (no UI) — that's the silent path used to
 * refresh tokens. Otherwise the API hands back a consent PendingIntent, which we
 * launch and resolve from its activity result. Access tokens only — no refresh
 * token, no on-device storage.
 */
@TauriPlugin
class DriveAuthPlugin(private val activity: Activity) : Plugin(activity) {
    private var pendingInvoke: Invoke? = null
    private var launcher: ActivityResultLauncher<IntentSenderRequest>? = null

    override fun load(webView: WebView) {
        super.load(webView)
        // Register via the ActivityResultRegistry directly, NOT
        // registerForActivityResult: Tauri loads plugins after the activity is
        // already RESUMED, and the lifecycle-aware overload throws if you register
        // that late ("must call register before they are STARTED"). The registry
        // overload has no such restriction (we just manage it manually).
        (activity as? ComponentActivity)?.let { componentActivity ->
            launcher = componentActivity.activityResultRegistry.register(
                "drive_auth_authorize",
                ActivityResultContracts.StartIntentSenderForResult()
            ) { result ->
                val invoke = pendingInvoke ?: return@register
                pendingInvoke = null
                try {
                    val authResult = Identity.getAuthorizationClient(activity)
                        .getAuthorizationResultFromIntent(result.data)
                    resolveWithToken(invoke, authResult)
                } catch (e: Exception) {
                    invoke.reject(e.message ?: "Authorization was cancelled or failed.")
                }
            }
        }
    }

    @Command
    fun authorize(invoke: Invoke) {
        val args = invoke.parseArgs(AuthorizeArgs::class.java)
        val scopes = (args.scopes ?: listOf(DRIVE_APPDATA_SCOPE)).map { Scope(it) }

        val request = AuthorizationRequest.builder()
            .setRequestedScopes(scopes)
            .build()

        Identity.getAuthorizationClient(activity)
            .authorize(request)
            .addOnSuccessListener { authResult ->
                if (authResult.hasResolution()) {
                    val pendingIntent = authResult.pendingIntent
                    val launcher = this.launcher
                    if (pendingIntent == null || launcher == null) {
                        invoke.reject("Consent required but no way to show it.")
                        return@addOnSuccessListener
                    }
                    pendingInvoke = invoke
                    try {
                        launcher.launch(
                            IntentSenderRequest.Builder(pendingIntent.intentSender).build()
                        )
                    } catch (e: Exception) {
                        pendingInvoke = null
                        invoke.reject("Couldn't show the consent screen: ${e.message}")
                    }
                } else {
                    resolveWithToken(invoke, authResult)
                }
            }
            .addOnFailureListener { e ->
                invoke.reject(e.message ?: "Authorization failed.")
            }
    }

    private fun resolveWithToken(invoke: Invoke, authResult: AuthorizationResult) {
        val token = authResult.accessToken
        if (token == null) {
            invoke.reject("Google returned no access token.")
            return
        }
        val ret = JSObject()
        ret.put("accessToken", token)
        invoke.resolve(ret)
    }

    companion object {
        private const val DRIVE_APPDATA_SCOPE =
            "https://www.googleapis.com/auth/drive.appdata"
    }
}
