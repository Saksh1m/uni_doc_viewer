using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class BrokerIpc {
    const int MessageLimit = 65536;
    static readonly SecurityIdentifier User = WindowsIdentity.GetCurrent().User;
    static readonly int Session = Process.GetCurrentProcess().SessionId;
    static readonly string Exe = Path.GetFullPath(Assembly.GetExecutingAssembly().Location);
    static readonly string Root = Path.GetDirectoryName(Exe);
    static readonly string Name = MakeName();
    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out uint pid);
    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    static string MakeName() {
        using (var sha = SHA256.Create()) {
            var hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Exe.ToUpperInvariant()))).Replace("-", "").Substring(0, 24);
            return "UFV-v6-" + User.Value + "-" + Session + "-" + hash;
        }
    }
    static Mutex CreateMutex(string suffix) {
        var security = new MutexSecurity();
        security.SetAccessRuleProtection(true, false);
        security.SetOwner(User);
        security.AddAccessRule(new MutexAccessRule(User, MutexRights.FullControl, AccessControlType.Allow));
        bool created;
        return new Mutex(false, "Local\\" + Name + suffix, out created, security);
    }
    static bool Enter(Mutex mutex, int milliseconds) {
        try { return mutex.WaitOne(milliseconds); }
        catch (AbandonedMutexException) { return true; }
    }
    static PipeSecurity CreatePipeSecurity() {
        var security = new PipeSecurity();
        security.SetAccessRuleProtection(true, false);
        security.SetOwner(User);
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null), PipeAccessRights.FullControl, AccessControlType.Deny));
        security.AddAccessRule(new PipeAccessRule(User, PipeAccessRights.FullControl, AccessControlType.Allow));
        return security;
    }
    static void VerifyPeer(PipeStream pipe, bool server) {
        uint pid;
        bool found = server ? GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out pid)
                            : GetNamedPipeClientProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out pid);
        if (!found) throw new IOException("The local viewer could not verify its connection.");
        using (var process = Process.GetProcessById((int)pid)) {
            if (process.SessionId != Session) throw new IOException("The local viewer refused a different Windows session.");
            IntPtr token;
            if (!OpenProcessToken(process.Handle, 8, out token)) throw new IOException("The local viewer could not verify the Windows account.");
            try {
                using (var identity = new WindowsIdentity(token)) {
                    if (!User.Equals(identity.User)) throw new IOException("The local viewer refused a different Windows account.");
                }
            } finally { CloseHandle(token); }
            if (server && !String.Equals(Path.GetFullPath(process.MainModule.FileName), Exe, StringComparison.OrdinalIgnoreCase))
                throw new IOException("Another program is using the viewer connection. Close it and retry.");
        }
    }
    static T Complete<T>(Task<T> task, int timeout) {
        if (!task.Wait(timeout)) throw new IOException("The local viewer did not respond in time. Reopen the file.");
        return task.Result;
    }
    static string ReadMessage(Stream stream, int timeout = 15000) {
        return Complete(ReadMessageAsync(stream), timeout);
    }
    static async Task<string> ReadMessageAsync(Stream stream) {
        using (var bytes = new MemoryStream()) {
            var one = new byte[1];
            while (bytes.Length < MessageLimit) {
                if (await stream.ReadAsync(one, 0, 1) == 0) throw new IOException("The local viewer connection ended. Reopen the file.");
                if (one[0] == 10) return Utf8.GetString(bytes.ToArray());
                bytes.WriteByte(one[0]);
            }
            throw new IOException("The local viewer request is too large.");
        }
    }
    static void WriteMessage(Stream stream, string value) {
        var bytes = Utf8.GetBytes(value + "\n");
        if (bytes.Length > MessageLimit) throw new IOException("The local viewer request is too large.");
        if (!stream.WriteAsync(bytes, 0, bytes.Length).Wait(15000)) throw new IOException("The local viewer connection timed out.");
        if (!stream.FlushAsync().Wait(15000)) throw new IOException("The local viewer connection timed out.");
    }
    static JavaScriptSerializer Json() { return new JavaScriptSerializer { MaxJsonLength = MessageLimit, RecursionLimit = 8 }; }
    static NamedPipeClientStream Connect(int timeout) {
        var pipe = new NamedPipeClientStream(".", Name, PipeDirection.InOut, PipeOptions.Asynchronous);
        try { pipe.Connect(timeout); VerifyPeer(pipe, true); return pipe; }
        catch { pipe.Dispose(); throw; }
    }
    static NamedPipeClientStream ConnectOrStart() {
        try { return Connect(150); } catch (TimeoutException) { }
        var deadline = Stopwatch.StartNew();
        Process host = null;
        try {
            while (deadline.ElapsedMilliseconds < 12000) {
                if (host == null || host.HasExited) {
                    if (host != null) host.Dispose();
                    // Launch the fixed GUI executable through Windows so it does
                    // not inherit the transient caller's anonymous pipe handles.
                    // No document path or user-supplied command reaches the shell.
                    host = Process.Start(new ProcessStartInfo(Exe, "--broker-host") {
                        UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = Root
                    });
                }
                try { return Connect(250); } catch (TimeoutException) { }
            }
            throw new IOException("The local viewer could not start. Reopen the file or reinstall the package.");
        } finally { if (host != null) host.Dispose(); }
    }
    // Startup is serialized; the host owns a separate lifetime mutex. Neither mutex
    // nor pipe leaves a stale PID file or credential on disk after a crash.
    internal static Dictionary<string, string> Request(string command, bool allowStart) {
        using (var gate = CreateMutex("-startup")) {
            if (!Enter(gate, 60000)) throw new IOException("The local viewer is busy. Please try again.");
            try {
                for (int attempt = 0; ; attempt++) {
                    try {
                        using (var pipe = allowStart ? ConnectOrStart() : Connect(1000)) {
                            WriteMessage(pipe, command);
                            return Json().Deserialize<Dictionary<string, string>>(ReadMessage(pipe, 45000));
                        }
                    } catch (IOException) { if (!allowStart || attempt != 0) throw; }
                }
            } finally { gate.ReleaseMutex(); }
        }
    }
    internal static Dictionary<string, string> OpenSession(string file) {
        var response = Request(Json().Serialize(new { op = "open", path = Path.GetFullPath(file) }), true);
        if (response.ContainsKey("error")) throw new IOException(response["error"]);
        return response;
    }
    internal static void Revoke(string fileId) {
        Request(Json().Serialize(new { op = "revoke", fileId = fileId }), false);
    }
    internal static int RunHost() {
        using (var owner = CreateMutex("-owner")) {
            if (!Enter(owner, 0)) return 0;
            Process child = null;
            try {
                var runtime = Path.Combine(Root, "runtime", "node.exe");
                var script = Path.Combine(Root, "app", "managed.cjs");
                if (!File.Exists(runtime) || !File.Exists(script)) return 1;
                var start = new ProcessStartInfo(runtime, Launcher.Quote(script)) {
                    UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Root,
                    RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
                };
                start.EnvironmentVariables.Remove("NODE_OPTIONS");
                start.EnvironmentVariables.Remove("NODE_PATH");
                child = Process.Start(start);
                // Consume errors without persisting paths, tokens or document content.
                child.ErrorDataReceived += (sender, e) => { };
                child.BeginErrorReadLine();
                var ready = Json().Deserialize<Dictionary<string, string>>(ReadMessage(child.StandardOutput.BaseStream));
                if (!ready.ContainsKey("ready") || ready["ready"] != "1") return 1;
                while (!child.HasExited) {
                    using (var pipe = new NamedPipeServerStream(Name, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
                            PipeOptions.Asynchronous, 4096, 4096, CreatePipeSecurity(), HandleInheritability.None)) {
                        var waiting = pipe.BeginWaitForConnection(null, null);
                        using (var signal = waiting.AsyncWaitHandle) {
                            while (!signal.WaitOne(250)) { if (child.HasExited) return 0; }
                            pipe.EndWaitForConnection(waiting);
                        }
                        string command;
                        try { VerifyPeer(pipe, false); command = ReadMessage(pipe); }
                        catch { continue; } // A failed client cannot take down existing sessions.
                        // Read the complete child response even if the caller disconnects.
                        // This keeps the next command from receiving the previous file's URL.
                        WriteMessage(child.StandardInput.BaseStream, command);
                        string response = ReadMessage(child.StandardOutput.BaseStream, 40000);
                        try { WriteMessage(pipe, response); } catch { }
                    }
                }
                return 0;
            } catch { return 1; }
            finally {
                if (child != null) {
                    try { child.StandardInput.Close(); if (!child.WaitForExit(2000)) child.Kill(); } catch { }
                    child.Dispose();
                }
                owner.ReleaseMutex();
            }
        }
    }
}
