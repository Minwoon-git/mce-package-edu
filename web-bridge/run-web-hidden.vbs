' MCE web bridge - start hidden (no console window)
' Double-click this instead of run-web.cmd to run the server in the background.
Dim fso, sh, here
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & here & "\run-web.cmd""", 0, False
