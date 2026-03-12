Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Dim dir
Dir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & Dir & "\start_server.bat""", 0, False
