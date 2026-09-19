package pro.wewed.app.ui.planner

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.OpenableColumns
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Hands worksheet data to other apps, only ever after an explicit tap (spec §5).
 * Nothing here reports success on its own: the system share sheet or print dialog is the outcome.
 */
object WorksheetFileActions {
    private const val EXPORT_DIR = "exports"
    private const val MAX_IMPORT_BYTES = 2 * 1024 * 1024

    /** Writes the CSV to cacheDir/exports and opens the system share sheet. Returns a problem message or null. */
    fun shareCsv(context: Context, fileName: String, csv: String): String? {
        return try {
            val dir = File(context.cacheDir, EXPORT_DIR).apply { mkdirs() }
            val file = File(dir, fileName)
            file.writeText(csv, Charsets.UTF_8)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                clipData = ClipData.newRawUri(fileName, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(send, "Share $fileName"))
            null
        } catch (_: ActivityNotFoundException) {
            "No app on this device can receive the file."
        } catch (_: Exception) {
            "The file couldn't be prepared. Please try again."
        }
    }

    /**
     * Loads the HTML into an off-screen WebView and hands it to the system print dialog.
     * The WebView must stay referenced until printing starts, so the caller keeps it in [holder].
     */
    fun print(context: Context, jobName: String, html: String, holder: (WebView?) -> Unit): String? {
        return try {
            val webView = WebView(context)
            webView.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

                override fun onPageFinished(view: WebView, url: String?) {
                    val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
                    printManager.print(jobName, view.createPrintDocumentAdapter(jobName), PrintAttributes.Builder().build())
                }
            }
            webView.settings.javaScriptEnabled = false
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
            holder(webView)
            null
        } catch (_: Exception) {
            "Printing isn't available on this device."
        }
    }

    fun displayName(context: Context, uri: Uri): String? = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }.getOrNull()

    /** Reads a picked text file. Throws with a plain message if it is too large or unreadable. */
    suspend fun readText(context: Context, uri: Uri): String = withContext(Dispatchers.IO) {
        val stream = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("The file couldn't be opened.")
        stream.use { input ->
            val bytes = input.readBytes()
            if (bytes.size > MAX_IMPORT_BYTES) throw IllegalStateException("The file is larger than 2 MB.")
            String(bytes, Charsets.UTF_8)
        }
    }
}
