// Test driver: invokes the same native methods as the GUI without opening a browser.
using System;
using System.IO;
using System.IO.Pipes;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Management;

class IpcProbe {
    [DllImport("kernel32.dll")] static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out uint pid);
    static int Main(string[] args) {
        var json = new JavaScriptSerializer();
        try {
            var type = Assembly.LoadFile(Path.GetFullPath(args[0])).GetType("BrokerIpc");
            var flags = BindingFlags.Static | BindingFlags.NonPublic;
            object result;
            if (args[1] == "open") result = type.GetMethod("OpenSession", flags).Invoke(null, new object[] { args[2] });
            else if (args[1] == "raw") result = type.GetMethod("Request", flags).Invoke(null, new object[] { args[2], false });
            else if (args[1] == "disconnect") {
                string name = (string)type.GetField("Name", flags).GetValue(null);
                using (var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut)) {
                    pipe.Connect(2000);
                    var writer = new StreamWriter(pipe); writer.WriteLine(json.Serialize(new { op = "open", path = args[2] })); writer.Flush();
                }
                result = new { ok = true };
            }
            else if (args[1] == "revoke") { type.GetMethod("Revoke", flags).Invoke(null, new object[] { args[2] }); result = new { ok = true }; }
            else if (args[1] == "inspect") {
                string name = (string)type.GetField("Name", flags).GetValue(null);
                using (var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut)) {
                    pipe.Connect(2000); uint pid;
                    if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out pid)) throw new Exception("Cannot identify host");
                    var security = pipe.GetAccessControl();
                    var allows = new List<string>(); var denies = new List<string>();
                    foreach (PipeAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier))) {
                        (rule.AccessControlType == AccessControlType.Allow ? allows : denies).Add(rule.IdentityReference.Value);
                    }
                    var children = new List<int>();
                    using (var search = new ManagementObjectSearcher("SELECT ProcessId FROM Win32_Process WHERE ParentProcessId=" + pid))
                        foreach (ManagementObject item in search.Get()) children.Add(Convert.ToInt32(item["ProcessId"]));
                    var writer = new StreamWriter(pipe); writer.WriteLine("{\"op\":\"invalid\"}"); writer.Flush();
                    new StreamReader(pipe).ReadLine();
                    result = new { pid = pid, children = children, allows = allows, denies = denies,
                        protectedAcl = security.AreAccessRulesProtected, user = WindowsIdentity.GetCurrent().User.Value };
                }
            } else throw new Exception("Invalid test command");
            Console.WriteLine(json.Serialize(result)); return 0;
        } catch (Exception error) {
            while (error.InnerException != null) error = error.InnerException;
            Console.WriteLine(json.Serialize(new { error = error.Message })); return 1;
        }
    }
}
