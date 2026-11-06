"""Sample private committed bytes for only the lab's browser/server process trees."""
import ctypes as C
from ctypes import wintypes as W
import json, sys, time
from pathlib import Path
roots={int(x) for x in sys.argv[1].split(',')}
output=Path(sys.argv[2]);stop=Path(sys.argv[3])
K=C.WinDLL('kernel32',use_last_error=True);P=C.WinDLL('psapi',use_last_error=True)
class Entry(C.Structure):
    _fields_=[('dwSize',W.DWORD),('cntUsage',W.DWORD),('pid',W.DWORD),('heap',C.c_size_t),('module',W.DWORD),('threads',W.DWORD),('parent',W.DWORD),('priority',W.LONG),('flags',W.DWORD),('exe',W.WCHAR*260)]
class Memory(C.Structure):
    _fields_=[('cb',W.DWORD),('faults',W.DWORD)]+[(n,C.c_size_t) for n in ['peakWorkingSet','workingSet','peakPagedPool','pagedPool','peakNonPagedPool','nonPagedPool','pagefile','peakPagefile','private']]
K.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD];K.CreateToolhelp32Snapshot.restype=W.HANDLE
K.Process32FirstW.argtypes=[W.HANDLE,C.POINTER(Entry)];K.Process32NextW.argtypes=[W.HANDLE,C.POINTER(Entry)]
K.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];K.OpenProcess.restype=W.HANDLE
K.CloseHandle.argtypes=[W.HANDLE];P.GetProcessMemoryInfo.argtypes=[W.HANDLE,C.POINTER(Memory),W.DWORD]
def sample():
    handle=K.CreateToolhelp32Snapshot(2,0)
    if handle==C.c_void_p(-1).value:raise OSError('Process snapshot failed')
    entry=Entry();entry.dwSize=C.sizeof(entry);parents={}
    try:
        ok=K.Process32FirstW(handle,C.byref(entry))
        while ok:
            parents[entry.pid]=entry.parent;ok=K.Process32NextW(handle,C.byref(entry))
    finally:K.CloseHandle(handle)
    selected=set(roots)
    while True:
        more={pid for pid,parent in parents.items() if parent in selected}
        if more<=selected:break
        selected|=more
    total=0;count=0;failed=[]
    for pid in selected&parents.keys():
        h=K.OpenProcess(0x410,False,pid)
        if not h:failed.append(pid);continue
        try:
            mem=Memory();mem.cb=C.sizeof(mem)
            if P.GetProcessMemoryInfo(h,C.byref(mem),C.sizeof(mem)):total+=mem.private;count+=1
            else:failed.append(pid)
        finally:K.CloseHandle(h)
    return dict(timeMs=time.time()*1000,privateBytes=total,processCount=count,unreadable=failed)
with output.open('w',encoding='utf-8') as f:
    start=time.monotonic()
    while not stop.exists() and time.monotonic()-start<600:
        f.write(json.dumps(sample())+'\n');f.flush();time.sleep(.1)
