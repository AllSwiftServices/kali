"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, CheckCircle, XCircle, Clock, Search, 
  ExternalLink, ChevronRight, Eye, AlertCircle,
  FileText, Shield, ArrowLeft, MoreVertical
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface KYCSubmission {
  id: string;
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  id_type: string;
  id_number: string;
  id_front_image: string;
  id_back_image: string;
  selfie_image: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

export default function AdminKYCPage() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!user || user.role !== 'admin') {
        navigate(createPageUrl('Home'));
        return;
      }
      fetchSubmissions();
    }
  }, [user, isLoadingAuth, navigate]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<KYCSubmission[]>('/kyc');
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err: any) {
      toast.error("Failed to load KYC submissions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !rejectReason) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setIsVerifying(true);
    try {
      const { error } = await api.post(`/kyc/${id}`, {
        status,
        rejection_reason: status === 'rejected' ? rejectReason : null
      });

      if (error) throw error;

      toast.success(`Submission ${status} successfully!`);
      setSelectedSubmission(null);
      setRejectReason("");
      fetchSubmissions();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredSubmissions = submissions.filter(s => 
    s.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoadingAuth || (user && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(createPageUrl('Home'))}
              className="p-2 mr-2 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">KYC Management</h1>
              <p className="text-xs text-muted-foreground">Review and verify user identity submissions</p>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {/* Statistics or Key Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-card border border-border p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">ACTION NEEDED</span>
                </div>
                <h3 className="text-2xl font-bold">{submissions.filter(s => s.status === 'pending').length}</h3>
                <p className="text-xs text-muted-foreground">Pending Verifications</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">VERIFIED</span>
                </div>
                <h3 className="text-2xl font-bold">{submissions.filter(s => s.status === 'approved').length}</h3>
                <p className="text-xs text-muted-foreground">Approved Submissions</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">ISSUES</span>
                </div>
                <h3 className="text-2xl font-bold">{submissions.filter(s => s.status === 'rejected').length}</h3>
                <p className="text-xs text-muted-foreground">Rejected Submissions</p>
            </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">ID Type</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Submitted</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 w-full bg-muted animate-pulse rounded-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((s) => (
                    <tr 
                      key={s.id} 
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => setSelectedSubmission(s)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{s.first_name} {s.last_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{s.user_email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium capitalize">{s.id_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                          s.status === 'approved' ? 'bg-primary/10 text-primary' :
                          s.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-amber-500/10 text-amber-500'
                        )}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(s.created_at), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Shield className="h-10 w-10 opacity-20" />
                        <p className="text-sm">No KYC submissions found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedSubmission(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedSubmission.first_name} {selectedSubmission.last_name}</h2>
                    <p className="text-xs text-muted-foreground">{selectedSubmission.user_email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Info Panel */}
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" /> Personal Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="First Name" value={selectedSubmission.first_name} />
                        <InfoItem label="Last Name" value={selectedSubmission.last_name} />
                        <InfoItem label="Date of Birth" value={selectedSubmission.date_of_birth ? format(new Date(selectedSubmission.date_of_birth), 'MMM dd, yyyy') : 'N/A'} />
                        <InfoItem label="Phone" value={selectedSubmission.phone} />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Address</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <InfoItem label="Street" value={selectedSubmission.address} />
                        <div className="grid grid-cols-2 gap-4">
                          <InfoItem label="City" value={selectedSubmission.city} />
                          <InfoItem label="State" value={selectedSubmission.state} />
                          <InfoItem label="Country" value={selectedSubmission.country} />
                          <InfoItem label="Postal Code" value={selectedSubmission.postal_code} />
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Identification</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="ID Type" value={selectedSubmission.id_type.replace(/_/g, ' ')} />
                        <InfoItem label="ID Number" value={selectedSubmission.id_number} />
                      </div>
                    </section>

                    {selectedSubmission.status === 'pending' && (
                        <section className="pt-4 border-t border-border">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Review Decision</h3>
                            <textarea 
                                placeholder="Rejection reason (required only if rejecting)..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                            />
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <button 
                                    disabled={isVerifying}
                                    onClick={() => handleUpdateStatus(selectedSubmission.user_id, 'approved')}
                                    className="h-12 rounded-2xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    {isVerifying ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <CheckCircle className="h-5 w-5" />} Approve KYC
                                </button>
                                <button 
                                    disabled={isVerifying}
                                    onClick={() => handleUpdateStatus(selectedSubmission.user_id, 'rejected')}
                                    className="h-12 rounded-2xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-destructive/20 disabled:opacity-50"
                                >
                                    {isVerifying ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <XCircle className="h-5 w-5" />} Reject KYC
                                </button>
                            </div>
                        </section>
                    )}

                    {selectedSubmission.status !== 'pending' && (
                        <div className={cn(
                            "p-6 rounded-2xl border flex items-start gap-4",
                            selectedSubmission.status === 'approved' ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-destructive/5 border-destructive/20 text-destructive'
                        )}>
                            {selectedSubmission.status === 'approved' ? <CheckCircle className="h-5 w-5 mt-0.5" /> : <XCircle className="h-5 w-5 mt-0.5" />}
                            <div>
                                <p className="text-sm font-bold capitalize">Verificaton {selectedSubmission.status}</p>
                                {selectedSubmission.rejection_reason && (
                                    <p className="text-xs mt-1 text-muted-foreground opacity-80">Reason: {selectedSubmission.rejection_reason}</p>
                                )}
                            </div>
                        </div>
                    )}
                  </div>

                  {/* Documents Panel */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5" /> Identity Documents
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <DocumentImage label="Front Side ID" url={selectedSubmission.id_front_image} />
                        <DocumentImage label="Back Side ID" url={selectedSubmission.id_back_image} />
                        <DocumentImage label="Liveness Selfie" url={selectedSubmission.selfie_image} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-muted/30 px-4 py-3 rounded-2xl border border-border/50">
      <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide font-bold">{label}</p>
      <p className="text-sm font-medium">{value || 'N/A'}</p>
    </div>
  );
}

function DocumentImage({ label, url }: { label: string, url: string }) {
  const [imgError, setImgError] = useState(false);

  // Validate that URL is a real URL and not 'undefined' or empty string
  const isValidUrl = url && url !== 'undefined' && url !== 'null' && url.startsWith('http');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {isValidUrl && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                <ExternalLink className="h-2.5 w-2.5" /> VIEW FULL SIZE
            </a>
        )}
      </div>
      <div className="aspect-4/3 rounded-2xl bg-muted border border-border overflow-hidden group relative flex items-center justify-center">
        {isValidUrl && !imgError ? (
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50 p-4 text-center">
            <Shield className="h-10 w-10" />
            <span className="text-[10px] font-bold">{imgError ? 'IMAGE FAILED TO LOAD' : 'NOT PROVIDED'}</span>
            {imgError && isValidUrl && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline mt-1">
                Open link directly
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
