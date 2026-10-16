import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2, Mail, MailOpen, PackageCheck, Truck, Clock3, XCircle } from "lucide-react";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

const icons = { delivered: PackageCheck, assigned: Truck, picked_up: Truck,
  cancelled: XCircle, expired: Clock3, expiry_warning: Clock3 };

export default function NotificationPanel() {
  const { token } = useAuth();
  const [items,setItems] = useState([]);
  const [unread,setUnread] = useState(0);
  const [page,setPage] = useState(1);
  const [total,setTotal] = useState(0);
  const [filter,setFilter] = useState("all");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [deleting,setDeleting] = useState(null);
  const version=useRef(0), lock=useRef(false);

  const load=useCallback(async()=>{
    const sequence=++version.current;
    setLoading(true);
    try {
      const result=await api("/notifications?page="+page+"&limit=10&state="+filter,{token});
      if(sequence!==version.current)return;
      if(page>1 && result.notifications.length===0){setPage(page-1);return;}
      setItems(result.notifications);setTotal(result.total);setUnread(result.unreadCount);
      setError("");
    }catch(e){if(sequence===version.current)setError(e.message);}
    finally{if(sequence===version.current)setLoading(false);}
  },[token,page,filter]);
  useEffect(()=>{
    load();
    window.addEventListener("foodbridge:refresh",load);
    return ()=>{version.current++;window.removeEventListener("foodbridge:refresh",load);};
  },[load]);

  async function mutate(path,method,message){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");setSuccess("");
    try{
      await api(path,{method,token});
      setDeleting(null);setSuccess(message);
      window.dispatchEvent(new Event("foodbridge:refresh"));
    }catch(e){setError(e.message);}
    finally{lock.current=false;setBusy(false);}
  }

  return <section className="notification-center animate-enter">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow">STAY IN THE LOOP</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Your notifications<span className="text-orange-500">.</span></h2>
        <p className="mt-2 text-sm text-stone-500">Every claim, pickup and handover, in one place.</p>
      </div>
      <span className="notification-count"><Bell size={20}/>{unread} unread</span>
    </div>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3 border-y border-stone-100 py-4">
      <div className="segmented-control" aria-label="Notification filter">
        {["all","unread"].map(value=><button key={value} type="button" aria-pressed={filter===value}
          disabled={busy} onClick={()=>{setFilter(value);setPage(1);}}
          className={filter===value?"selected":""}>{value==="all"?"All activity":"Unread"}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="icon-button" aria-label="Refresh inbox" disabled={loading||busy} onClick={load}><RefreshCw size={18} className={loading?"animate-spin":""}/></button>
        <button className="btn-secondary !px-3 !py-2" disabled={busy||unread===0}
          onClick={()=>mutate("/notifications/read-all","PATCH","All notifications marked as read.")}><CheckCheck size={16}/>Mark all read</button>
        <button className="btn-secondary !px-3 !py-2" disabled={busy}
          onClick={()=>{setError("");setDeleting({allRead:true});}}><Trash2 size={16}/>Clear read</button>
      </div>
    </div>
    {success&&<p className="success-banner mb-4" role="status"><CheckCheck size={18}/>{success}</p>}
    {error&&!deleting&&<p className="error-box mb-4" role="alert">{error}</p>}
    {loading&&<p className="mb-3 text-sm text-stone-500" role="status">Updating your inbox…</p>}
    {!loading&&items.length===0&&<div className="empty-state">
      <span className="empty-state-icon"><Bell size={32}/></span>
      <h3 className="mt-5 text-xl font-bold">{filter==="unread"?"You're all caught up":"A little quiet, for now"}</h3>
      <p className="mt-2 text-sm text-stone-500">New donation and delivery activity will appear here.</p>
    </div>}
    <div className="space-y-3">
      {items.map((item,index)=>{
        const Icon=icons[item.type]||Bell;
        return <article key={item._id} className={"notification-row animate-enter "+(!item.readAt?"notification-row-unread":"")}
          style={{animationDelay:Math.min(index,5)*45+"ms"}}>
          <span className="notification-icon"><Icon size={21}/></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold">{item.title}</h3>
              {!item.readAt&&<span className="status-dot shrink-0" aria-label="Unread"/>}
            </div>
            <p className="mt-1 break-words text-sm leading-6 text-stone-600">{item.message}</p>
            <p className="mt-2 text-xs text-stone-500">{new Date(item.createdAt).toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="text-action" disabled={busy} onClick={()=>mutate(
                "/notifications/"+item._id+(item.readAt?"/unread":"/read"),"PATCH",
                item.readAt?"Marked unread.":"Marked read.")}>
                {item.readAt?<Mail size={15}/>:<MailOpen size={15}/>}
                {item.readAt?"Mark unread":"Mark read"}
              </button>
              <button className="text-action !text-red-700" disabled={busy}
                onClick={()=>{setError("");setDeleting(item);}}><Trash2 size={15}/>Delete</button>
            </div>
          </div>
        </article>;
      })}
    </div>
    <div className="mt-6 flex items-center justify-between gap-3">
      <button className="btn-secondary" disabled={page===1||loading||busy} onClick={()=>setPage(p=>p-1)}>Previous</button>
      <span className="text-sm text-stone-500">{page} / {Math.max(1,Math.ceil(total/10))}</span>
      <button className="btn-secondary" disabled={page*10>=total||loading||busy} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div>
    <p className="mt-5 text-xs text-stone-500">Automatically created in-app alerts. Background browser push is not enabled.</p>
    {deleting&&<ConfirmDialog title={deleting.allRead?"Clear read notifications?":"Delete this notification?"}
      busy={busy} error={error} onCancel={()=>{setDeleting(null);setError("");}}
      onConfirm={()=>mutate(deleting.allRead?"/notifications/read":"/notifications/"+deleting._id,"DELETE",
        deleting.allRead?"Read notifications cleared.":"Notification deleted.")}>
      {deleting.allRead?"Read notifications will be removed from your inbox. Unread alerts will stay.":deleting.title}
      <p className="mt-2">This only changes your inbox. It does not cancel or delete a donation.</p>
    </ConfirmDialog>}
  </section>;
}
