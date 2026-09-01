"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, CheckCircle2, AlertCircle, User, 
  FileText, Camera, Upload, ChevronRight, ChevronLeft,
  Info, Lock, Zap, Clock, Globe, MapPin, Phone, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const INPUT_CLASS = "w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors";
const LABEL_CLASS = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5";

function UploadBox({ label, value, onChange, hint }: { label: string, value: string, onChange: (v: string) => void, hint?: string }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFile = async (file: File) => {
    if (!file || !user) return;
    const toastId = toast.loading('Uploading...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `kyc/${user.id}/${Math.random().toString(36).substring(7)}`);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Upload failed');
      
      onChange(result.url);
      toast.success('Uploaded!', { id: toastId });
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message, { id: toastId });
    }
  };

  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all overflow-hidden",
          drag ? "border-primary bg-primary/5" : value ? "border-primary bg-card" : "border-border bg-card"
        )}
        style={{ minHeight: 110 }}
      >
        {value ? (
          <div className="relative">
            <img src={value} alt="preview" className="w-full h-36 object-cover rounded-xl" />
            <button
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="absolute top-2 right-2 bg-black/70 rounded-full p-1 cursor-pointer z-10 hover:scale-110 transition-transform"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 h-full w-full gap-3">
             <div className="flex gap-4 w-full max-w-xs mx-auto">
               <label className="relative flex-1 flex flex-col items-center justify-center gap-2 bg-muted/50 rounded-2xl hover:bg-muted cursor-pointer transition-colors p-3 border border-transparent hover:border-primary/20">
                  <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={e => {
                    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                    e.target.value = '';
                  }} />
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-center">Upload File</span>
               </label>
               <label className="relative flex-1 flex flex-col items-center justify-center gap-2 bg-muted/50 rounded-2xl hover:bg-muted cursor-pointer transition-colors p-3 border border-transparent hover:border-primary/20">
                  <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={e => {
                    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                    e.target.value = '';
                  }} />
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-center">Take Photo</span>
               </label>
             </div>
             {hint && <p className="text-[10px] text-muted-foreground/60 text-center">{hint}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyIdentity() {
  const { user, isLoadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', phone: '',
    address: '', city: '', state: '', country: '', postal_code: '',
    id_type: 'passport', id_number: '',
    id_front_image: '', id_back_image: '', selfie_image: '',
  });

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      navigate(createPageUrl('Home'));
      return;
    }

    (async () => {
      try {
        const { data } = await api.get<any>(`/kyc/${user.id}`);
        if (data) {
          setExisting(data);
          if (data.status !== 'rejected') {
            setForm({
              first_name: data.first_name || '',
              last_name: data.last_name || '',
              date_of_birth: data.date_of_birth || '',
              phone: data.phone || '',
              address: data.address || '',
              city: data.city || '',
              state: data.state || '',
              country: data.country || '',
              postal_code: data.postal_code || '',
              id_type: data.id_type || 'passport',
              id_number: data.id_number || '',
              id_front_image: data.id_front_image || '',
              id_back_image: data.id_back_image || '',
              selfie_image: data.selfie_image || '',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching KYC status:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isLoadingAuth, navigate]);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.id_number || !form.id_front_image || !form.selfie_image) {
      toast.error('Please fill in all required fields and upload images.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    const toastId = toast.loading('Submitting verification...');
    try {
      const payload = {
        user_id: user.id,
        user_email: user.email,
        status: 'pending',
        ...form,
      };

      const { data, error } = await api.post('/kyc', payload);
      if (error) throw error;

      setExisting(data);
      toast.success('Submitted successfully!', { id: toastId });
      // Refresh auth context so the KYC gate reads the new 'pending' status
      await refreshUser();
    } catch (error: any) {
      toast.error('Submission failed: ' + error.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background">
      <header className="sticky top-0 z-30 border-b flex items-center gap-3 px-4 py-4 bg-background/95 border-border">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-bold text-foreground text-lg">Identity Verification</h1>
          <p className="text-xs text-muted-foreground">Verify your identity to unlock full access</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Status Banner */}
        {existing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-2xl p-4 flex items-center gap-3 border transition-colors",
              existing.status === 'approved' ? "bg-primary/10 border-primary" : 
              existing.status === 'rejected' ? "bg-destructive/10 border-destructive" : 
              "bg-muted border-border"
            )}
          >
            {existing.status === 'approved' && <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />}
            {existing.status === 'pending' && <Clock className="h-6 w-6 shrink-0 text-primary" />}
            {existing.status === 'rejected' && <X className="h-6 w-6 shrink-0 text-destructive" />}
            <div>
              <p className="font-bold text-foreground text-sm">
                {existing.status === 'approved' ? '✔ Verified' : existing.status === 'pending' ? '⏳ Verification Pending' : '✖ Verification Failed'}
              </p>
              {existing.rejection_reason && <p className="text-xs text-destructive mt-0.5">{existing.rejection_reason}</p>}
              {existing.status === 'pending' && <p className="text-xs text-muted-foreground mt-0.5">Our team typically reviews within 1–2 business days.</p>}
            </div>
          </motion.div>
        )}

        {(!existing || existing.status === 'rejected') && (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 border space-y-4 bg-card border-border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-foreground text-sm uppercase tracking-wider">Personal Information</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL_CLASS}>First Name *</label><input className={INPUT_CLASS} placeholder="John" value={form.first_name} onChange={set('first_name')} /></div>
                <div><label className={LABEL_CLASS}>Last Name *</label><input className={INPUT_CLASS} placeholder="Doe" value={form.last_name} onChange={set('last_name')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL_CLASS}>Date of Birth</label><input type="date" className={INPUT_CLASS} value={form.date_of_birth} onChange={set('date_of_birth')} /></div>
                <div><label className={LABEL_CLASS}>Phone Number</label><input className={INPUT_CLASS} placeholder="+1 234 567 890" value={form.phone} onChange={set('phone')} /></div>
              </div>
              <div><label className={LABEL_CLASS}>Residential Address</label><input className={INPUT_CLASS} placeholder="123 Main Street" value={form.address} onChange={set('address')} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL_CLASS}>City</label><input className={INPUT_CLASS} placeholder="New York" value={form.city} onChange={set('city')} /></div>
                <div><label className={LABEL_CLASS}>State</label><input className={INPUT_CLASS} placeholder="NY" value={form.state} onChange={set('state')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL_CLASS}>Country</label><input className={INPUT_CLASS} placeholder="United States" value={form.country} onChange={set('country')} /></div>
                <div><label className={LABEL_CLASS}>Postal Code</label><input className={INPUT_CLASS} placeholder="10001" value={form.postal_code} onChange={set('postal_code')} /></div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl p-5 border space-y-4 bg-card border-border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-foreground text-sm uppercase tracking-wider">Identity Document</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>ID Type *</label>
                  <select className={INPUT_CLASS} value={form.id_type} onChange={set('id_type')}>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="national_id">National ID</option>
                  </select>
                </div>
                <div><label className={LABEL_CLASS}>ID Number *</label><input className={INPUT_CLASS} placeholder="AB1234567" value={form.id_number} onChange={set('id_number')} /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UploadBox label="Front of ID *" value={form.id_front_image} onChange={v => setForm(f => ({ ...f, id_front_image: v }))} hint="Clear photo of front" />
                <UploadBox label="Back of ID" value={form.id_back_image} onChange={v => setForm(f => ({ ...f, id_back_image: v }))} hint="Clear photo of back" />
              </div>
              <UploadBox label="Selfie *" value={form.selfie_image} onChange={v => setForm(f => ({ ...f, selfie_image: v }))} hint="Hold your ID next to your face" />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-base border-2 transition-all shadow-lg shadow-primary/20",
                submitting ? "bg-muted border-muted-foreground text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground border-primary hover:opacity-90"
              )}
            >
              {submitting ? 'Submitting...' : 'Submit for Verification'}
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}