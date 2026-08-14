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
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
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
                invoke.reject(describeAuthFailure(e))
            }
    }

    /**
     * Turn a Play Services failure into something a user — or a tester filing a
     * report — can act on. An ApiException's own message is just the numeric
     * status ("10: "), which tells nobody anything.
     *
     * DEVELOPER_ERROR is the one worth spelling out. It means Google didn't
     * recognise the combination of package name and signing certificate that
     * asked for the token, and it appears ONLY in builds signed by a
     * certificate that has no matching Android OAuth client. Installs from Play
     * are signed by Play's own app-signing key, not the upload key, so a build
     * that authorizes perfectly when sideloaded can fail here for every single
     * store install. See desktop/README.md → "Google Drive on Play builds".
     */
    private fun describeAuthFailure(e: Exception): String {
        val api = e as? ApiException ?: return e.message ?: "Authorization failed."
        return when (api.statusCode) {
            CommonStatusCodes.DEVELOPER_ERROR ->
                "Google Drive isn't set up for this build of the app (error 10). " +
                    "This is a configuration problem, not something you did — " +
                    "please report it."
            CommonStatusCodes.NETWORK_ERROR ->
                "Couldn't reach Google. Check your connection and try again."
            CommonStatusCodes.CANCELED ->
                "Google Drive sign-in was cancelled."
            CommonStatusCodes.SIGN_IN_REQUIRED ->
                "Add a Google account to this device, then try again."
            else ->
                "Google Drive sign-in failed (error ${api.statusCode})."
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
