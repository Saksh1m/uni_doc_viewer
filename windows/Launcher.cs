using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Windows.Forms;

internal static class Launcher {
    // Windows command-line quoting, without cmd.exe or PowerShell interpretation.
    internal static string Quote(string value) {
        var output = new System.Text.StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { output.Append('\\', slashes * 2 + 1); output.Append(c); }
            else { output.Append('\\', slashes); output.Append(c); }
            slashes = 0;
        }
        output.Append('\\', slashes * 2); output.Append('"'); return output.ToString();
    }
    [STAThread]
    static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--broker-host") return BrokerIpc.RunHost();
        string fileId = null;
        try {
            Application.EnableVisualStyles();
            string file;
            if (args.Length == 0) {
                using (var picker = new OpenFileDialog()) {
                    picker.Title = "Open a file in your browser";
                    picker.Filter = "Supported files|*.txt;*.md;*.pdf;*.png;*.jpg;*.jpeg;*.webp;*.docx;*.epub;*.csv;*.tsv;*.xlsx|PDF files|*.pdf|Documents and books|*.docx;*.epub;*.md;*.txt|Images|*.png;*.jpg;*.jpeg;*.webp|Spreadsheets and data|*.xlsx;*.csv;*.tsv";
                    picker.CheckFileExists = true;
                    if (picker.ShowDialog() != DialogResult.OK) return 0;
                    file = picker.FileName;
                }
            } else if (args.Length == 1) { file = args[0]; }
            else { throw new Exception("Choose one file at a time."); }
            var response = BrokerIpc.OpenSession(file);
            if (response.ContainsKey("fileId")) fileId = response["fileId"];
            Uri uri;
            if (!response.ContainsKey("url") || !Uri.TryCreate(response["url"], UriKind.Absolute, out uri) || uri.Scheme != "http" || uri.Host != "127.0.0.1") throw new Exception("The local viewer returned an invalid address.");
            try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
            catch { throw new Exception("Windows could not open your default browser. Set a default browser in Windows Settings and reopen the file."); }
            return 0;
        } catch (Exception error) {
            // A browser-launch failure revokes only this file, never the shared host.
            if (fileId != null) { try { BrokerIpc.Revoke(fileId); } catch {} }
            MessageBox.Show(error.Message, "Universal File Viewer", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
