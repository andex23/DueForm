"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Save,
  Plus,
  Trash2,
  Users,
  Package,
  CreditCard,
  Building2,
  Star,
  Edit3,
  X,
  Landmark,
  Bitcoin,
  Wallet,
  Cloud,
} from "lucide-react";
import toast from "react-hot-toast";
import Shell from "@/components/Shell";
import CloudSyncPanel from "@/components/CloudSyncPanel";
import {
  BusinessProfile,
  ClientInfo,
  SavedService,
  PaymentInfo,
  EmailSenderSettings,
  PaymentMethod,
  PaymentMethodType,
  CRYPTO_CURRENCIES,
  getCryptoNetworkOptions,
} from "@/lib/types";
import {
  getBusinessProfiles,
  saveBusinessProfile,
  deleteBusinessProfile,
  getPaymentInfo,
  savePaymentInfo,
  getEmailSenderSettings,
  saveEmailSenderSettings,
  getSavedClients,
  saveClient,
  deleteClient,
  getSavedServices,
  saveService,
  deleteService,
} from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

const emptyBusiness: BusinessProfile = {
  id: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  tagline: "",
  isDefault: false,
};

const emptyPaymentInfo: PaymentInfo = {
  methods: [],
  paymentLink: "",
  paymentNote: "",
};

const emptyEmailSender: EmailSenderSettings = {
  fromName: "Your Business",
  fromEmail: "",
};

function emptyMethod(type: PaymentMethodType): PaymentMethod {
  return {
    id: uuidv4(),
    type,
    cryptoCurrency: type === "crypto" ? "" : undefined,
    label:
      type === "bank"
        ? "Bank Transfer"
        : type === "crypto"
          ? "Crypto"
          : "PayPal",
  };
}

const METHOD_ICONS: Record<PaymentMethodType, typeof Landmark> = {
  bank: Landmark,
  crypto: Bitcoin,
  paypal: Wallet,
};

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  bank: "Bank Transfer",
  crypto: "Crypto",
  paypal: "PayPal",
};

export default function SettingsPage() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  return <SettingsContent />;
}

function SettingsContent() {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>(
    () => getBusinessProfiles()
  );
  const [editingBusiness, setEditingBusiness] =
    useState<BusinessProfile | null>(null);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [payment, setPayment] = useState<PaymentInfo>(
    () => getPaymentInfo() || emptyPaymentInfo
  );
  const [emailSender, setEmailSender] = useState<EmailSenderSettings>(
    () => getEmailSenderSettings() || emptyEmailSender
  );
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>(() => getSavedClients());
  const [services, setServices] = useState<SavedService[]>(
    () => getSavedServices()
  );
  const [activeTab, setActiveTab] = useState<
    "business" | "payment" | "clients" | "services" | "cloud"
  >("business");
  const [newClient, setNewClient] = useState<ClientInfo>({
    name: "",
    email: "",
    phone: "",
    address: "",
    company: "",
  });
  const [newService, setNewService] = useState<SavedService>({
    id: "",
    name: "",
    description: "",
    defaultRate: 0,
    defaultTax: 0,
  });

  const inputClass =
    "w-full bg-bg-input border border-border rounded-lg px-3.5 py-2.5 text-[14px] text-text placeholder-text-dim/60 outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20";
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim mb-1.5";

  const tabs = [
    { key: "business" as const, label: "Business", icon: Building2 },
    { key: "payment" as const, label: "Payment", icon: CreditCard },
    { key: "clients" as const, label: "Clients", icon: Users },
    { key: "services" as const, label: "Services", icon: Package },
    { key: "cloud" as const, label: "Cloud", icon: Cloud },
  ];
  const panelClass =
    "rounded-[12px] border border-border bg-bg-card shadow-[0_8px_20px_rgba(0,0,0,0.12)]";
  const insetPanelClass =
    "rounded-[10px] border border-border bg-bg-elevated/55";
  const primaryButtonClass =
    "flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg transition-all hover:bg-accent-hover";
  const secondaryButtonClass =
    "flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-[13px] font-medium text-text-muted transition-all hover:border-accent/30 hover:text-accent";
  const iconButtonClass =
    "flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-text-dim/40 transition-all hover:bg-accent/10 hover:text-accent";
  const modalClass =
    "bg-bg-card border border-border rounded-[12px] w-[520px] p-6 animate-scale-in shadow-[0_14px_34px_rgba(0,0,0,0.24)]";
  const tabMeta = {
    business: {
      eyebrow: "Workspace Settings",
      title: "Business Profiles",
      description:
        "Manage the businesses used across invoices. The default profile fills new documents automatically.",
      summary: `${businesses.length} profile${businesses.length !== 1 ? "s" : ""}`,
    },
    payment: {
      eyebrow: "Workspace Settings",
      title: "Payment Defaults",
      description:
        "Keep reusable payout details, hosted payment links, and sender identity aligned across new invoices.",
      summary: `${payment.methods.length} method${payment.methods.length !== 1 ? "s" : ""}`,
    },
    clients: {
      eyebrow: "Workspace Settings",
      title: "Saved Clients",
      description:
        "Store repeat billing contacts so they can be dropped into invoices without retyping details.",
      summary: `${clients.length} saved client${clients.length !== 1 ? "s" : ""}`,
    },
    services: {
      eyebrow: "Workspace Settings",
      title: "Saved Services",
      description:
        "Build a reusable catalog of common items, rates, and tax defaults for faster invoice creation.",
      summary: `${services.length} saved service${services.length !== 1 ? "s" : ""}`,
    },
    cloud: {
      eyebrow: "Workspace Settings",
      title: "Cloud Workspace",
      description:
        "Back up local work, restore it on another device, and control how this invoice workspace syncs.",
      summary: "Sync & restore",
    },
  } as const;
  const activeTabMeta = tabMeta[activeTab];

  const handleOpenNewBusiness = () => {
    setEditingBusiness({
      ...emptyBusiness,
      id: uuidv4(),
      isDefault: businesses.length === 0,
    });
    setShowBusinessForm(true);
  };

  const handleEditBusiness = (business: BusinessProfile) => {
    setEditingBusiness({ ...business });
    setShowBusinessForm(true);
  };

  const handleSaveBusiness = () => {
    if (!editingBusiness) return;
    if (!editingBusiness.name.trim()) {
      toast.error("Business name is required");
      return;
    }

    saveBusinessProfile(editingBusiness);
    setBusinesses(getBusinessProfiles());
    setShowBusinessForm(false);
    setEditingBusiness(null);
    toast.success("Business profile saved");
  };

  const handleDeleteBusiness = (id: string) => {
    if (businesses.length <= 1) {
      toast.error("You must have at least one business profile");
      return;
    }

    deleteBusinessProfile(id);
    setBusinesses(getBusinessProfiles());
    toast.success("Business profile removed");
  };

  const handleSetDefault = (business: BusinessProfile) => {
    saveBusinessProfile({ ...business, isDefault: true });
    setBusinesses(getBusinessProfiles());
    toast.success(`${business.name} set as default`);
  };

  const handleSavePayment = () => {
    savePaymentInfo(payment);
    saveEmailSenderSettings(emailSender);
    toast.success("Payment defaults saved");
  };

  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      toast.error("Client name is required");
      return;
    }

    const client = { ...newClient, id: uuidv4() };
    saveClient(client);
    setClients(getSavedClients());
    setNewClient({
      name: "",
      email: "",
      phone: "",
      address: "",
      company: "",
    });
    toast.success("Client saved");
  };

  const handleDeleteClient = (id: string) => {
    deleteClient(id);
    setClients(getSavedClients());
    toast.success("Client removed");
  };

  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error("Service name is required");
      return;
    }

    const service = { ...newService, id: uuidv4() };
    saveService(service);
    setServices(getSavedServices());
    setNewService({
      id: "",
      name: "",
      description: "",
      defaultRate: 0,
      defaultTax: 0,
    });
    toast.success("Service saved");
  };

  const handleDeleteService = (id: string) => {
    deleteService(id);
    setServices(getSavedServices());
    toast.success("Service removed");
  };

  const addPaymentMethod = (type: PaymentMethodType) => {
    setPayment((current) => ({
      ...current,
      methods: [...current.methods, emptyMethod(type)],
    }));
    setShowAddMethod(false);
  };

  const removePaymentMethod = (id: string) => {
    setPayment((current) => ({
      ...current,
      methods: current.methods.filter((method) => method.id !== id),
    }));
  };

  const updatePaymentMethod = (
    id: string,
    updates: Partial<PaymentMethod>
  ) => {
    setPayment((current) => ({
      ...current,
      methods: current.methods.map((method) =>
        method.id === id ? { ...method, ...updates } : method
      ),
    }));
  };

  return (
    <Shell>
      <div className="mx-auto max-w-[1080px] animate-fade-in space-y-6">
        <section className={`${panelClass} p-6`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                {activeTabMeta.eyebrow}
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] font-semibold tracking-tight text-text">
                {activeTabMeta.title}
              </h1>
              <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-text-muted">
                {activeTabMeta.description}
              </p>
            </div>

            <div className="rounded-[10px] border border-border bg-bg-elevated/75 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                Overview
              </div>
              <div className="mt-1 text-[13px] text-text-muted">{activeTabMeta.summary}</div>
            </div>
          </div>

          <div className="mt-6 rounded-[10px] border border-border bg-bg-elevated p-1">
            <div className="grid gap-1 sm:grid-cols-5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "bg-transparent text-text-dim hover:text-text-muted"
                    }`}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === "business" && (
          <div className="space-y-4 animate-fade-in">
            <section className={`${panelClass} p-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                    Business Profiles
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-text-muted">
                    The default profile is used first when creating new invoices.
                  </p>
                </div>
                <button onClick={handleOpenNewBusiness} className={primaryButtonClass}>
                  <Plus size={15} />
                  Add Business
                </button>
              </div>

              {businesses.length === 0 ? (
                <div className={`${insetPanelClass} mt-4 px-6 py-12 text-center`}>
                  <Building2 size={32} className="mx-auto mb-3 text-text-dim/30" />
                  <p className="text-[13px] text-text-dim m-0">No business profiles yet</p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
                  {businesses.map((business, index) => (
                    <div
                      key={business.id}
                      className={`flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${
                        index !== businesses.length - 1 ? "border-b border-border/80" : ""
                      } ${business.isDefault ? "bg-accent/6" : "bg-bg-card"}`}
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[16px] font-semibold text-text">{business.name}</span>
                          {business.isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                              <Star size={10} />
                              Default
                            </span>
                          )}
                        </div>
                        {business.tagline && (
                          <p className="m-0 mt-1 text-[12px] text-accent/80">{business.tagline}</p>
                        )}
                        <div className="mt-2 text-[12px] leading-6 text-text-dim">
                          {[business.email, business.phone, business.website].filter(Boolean).join(" · ")}
                        </div>
                        {business.address && (
                          <p className="m-0 mt-1 text-[12px] leading-6 text-text-dim/80">
                            {business.address}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!business.isDefault && (
                          <button
                            onClick={() => handleSetDefault(business)}
                            className={secondaryButtonClass}
                            title="Set as default"
                          >
                            <Star size={13} />
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleEditBusiness(business)}
                          className={iconButtonClass}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBusiness(business.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-text-dim/30 transition-all hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {showBusinessForm && editingBusiness && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className={modalClass}>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-display)] text-[20px] font-semibold m-0">
                      {editingBusiness.name ? "Edit Business" : "New Business"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowBusinessForm(false);
                        setEditingBusiness(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-transparent text-text-dim transition-all hover:border-border-hover hover:text-text"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Business Name *</label>
                        <input
                          className={inputClass}
                          value={editingBusiness.name}
                          onChange={(e) =>
                            setEditingBusiness({ ...editingBusiness, name: e.target.value })
                          }
                          placeholder="Your Business"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Tagline</label>
                        <input
                          className={inputClass}
                          value={editingBusiness.tagline}
                          onChange={(e) =>
                            setEditingBusiness({ ...editingBusiness, tagline: e.target.value })
                          }
                          placeholder="Creative Studio"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Email</label>
                        <input
                          className={inputClass}
                          type="email"
                          value={editingBusiness.email}
                          onChange={(e) =>
                            setEditingBusiness({ ...editingBusiness, email: e.target.value })
                          }
                          placeholder="hello@example.com"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Phone</label>
                        <input
                          className={inputClass}
                          value={editingBusiness.phone}
                          onChange={(e) =>
                            setEditingBusiness({ ...editingBusiness, phone: e.target.value })
                          }
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Address</label>
                      <textarea
                        className={`${inputClass} resize-none`}
                        rows={2}
                        value={editingBusiness.address}
                        onChange={(e) =>
                          setEditingBusiness({ ...editingBusiness, address: e.target.value })
                        }
                        placeholder="123 Studio St, City, State, ZIP"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Website</label>
                      <input
                        className={inputClass}
                        value={editingBusiness.website}
                        onChange={(e) =>
                          setEditingBusiness({ ...editingBusiness, website: e.target.value })
                        }
                        placeholder="drustudiolab.com"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={editingBusiness.isDefault}
                        onChange={(e) =>
                          setEditingBusiness({ ...editingBusiness, isDefault: e.target.checked })
                        }
                        className="accent-[var(--color-accent)]"
                      />
                      <span className="text-[13px] text-text-muted">
                        Set as default business for new invoices
                      </span>
                    </label>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowBusinessForm(false);
                        setEditingBusiness(null);
                      }}
                      className={secondaryButtonClass}
                    >
                      Cancel
                    </button>
                    <button onClick={handleSaveBusiness} className={primaryButtonClass}>
                      <Save size={15} />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "payment" && (
          <div className="space-y-4 animate-fade-in">
            <section className={`${panelClass} p-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                    Default Payment Methods
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-text-muted">
                    Auto-fill bank, crypto, PayPal, and hosted payment details on new invoices.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowAddMethod((open) => !open)}
                      className={secondaryButtonClass}
                    >
                      <Plus size={15} />
                      Add Method
                    </button>
                    {showAddMethod && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-[210px] overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg shadow-black/20">
                        {(["bank", "crypto", "paypal"] as PaymentMethodType[]).map((type) => {
                          const Icon = METHOD_ICONS[type];
                          return (
                            <button
                              key={type}
                              onClick={() => addPaymentMethod(type)}
                              className="flex w-full items-center gap-3 border-b border-border/50 bg-transparent px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
                            >
                              <Icon size={16} className="text-accent" />
                              <span className="text-[13px] font-medium text-text">
                                {METHOD_LABELS[type]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button onClick={handleSavePayment} className={primaryButtonClass}>
                    <Save size={15} />
                    Save
                  </button>
                </div>
              </div>

              {payment.methods.length === 0 ? (
                <div className={`${insetPanelClass} mt-4 px-6 py-12 text-center`}>
                  <CreditCard size={26} className="mx-auto mb-2 text-text-dim/30" />
                  <p className="text-[13px] text-text-dim m-0">No default payment methods yet</p>
                  <p className="mt-1 text-[11px] text-text-dim/60">
                    Add bank, crypto, or PayPal details for faster invoice creation.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {payment.methods.map((method) => {
                    const Icon = METHOD_ICONS[method.type];

                    return (
                      <div key={method.id} className={`${insetPanelClass} p-5`}>
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                              <Icon size={16} />
                            </div>
                            <input
                              className="border-0 bg-transparent text-[14px] font-semibold text-text outline-none placeholder:text-text-dim/40"
                              value={method.label}
                              onChange={(e) =>
                                updatePaymentMethod(method.id, { label: e.target.value })
                              }
                              placeholder="Label"
                            />
                          </div>
                          <button
                            onClick={() => removePaymentMethod(method.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-text-dim/30 transition-all hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {method.type === "bank" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className={labelClass}>Bank Name</label>
                              <input
                                className={inputClass}
                                value={method.bankName || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { bankName: e.target.value })
                                }
                                placeholder="e.g. Chase, Access Bank"
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Account Name</label>
                              <input
                                className={inputClass}
                                value={method.accountName || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { accountName: e.target.value })
                                }
                                placeholder="Account holder name"
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Account Number</label>
                              <input
                                className={inputClass}
                                value={method.accountNumber || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { accountNumber: e.target.value })
                                }
                                placeholder="0123456789"
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Routing Number</label>
                              <input
                                className={inputClass}
                                value={method.routingNumber || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { routingNumber: e.target.value })
                                }
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                        )}

                        {method.type === "crypto" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className={labelClass}>Crypto Currency</label>
                              <select
                                className={`${inputClass} cursor-pointer`}
                                value={method.cryptoCurrency || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, {
                                    cryptoCurrency: e.target.value,
                                  })
                                }
                              >
                                <option value="">Select currency</option>
                                {CRYPTO_CURRENCIES.map((currency) => (
                                  <option key={currency.code} value={currency.code}>
                                    {currency.code} · {currency.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Network</label>
                              <select
                                className={`${inputClass} cursor-pointer`}
                                value={method.network || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { network: e.target.value })
                                }
                              >
                                <option value="">Select network</option>
                                {getCryptoNetworkOptions(method.network).map((network) => (
                                  <option key={network.value} value={network.value}>
                                    {network.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className={labelClass}>Wallet Address</label>
                              <input
                                className={inputClass}
                                value={method.walletAddress || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, {
                                    walletAddress: e.target.value,
                                  })
                                }
                                placeholder="Wallet address"
                              />
                            </div>
                          </div>
                        )}

                        {method.type === "paypal" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className={labelClass}>PayPal Email</label>
                              <input
                                className={inputClass}
                                type="email"
                                value={method.paypalEmail || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { paypalEmail: e.target.value })
                                }
                                placeholder="you@example.com"
                              />
                            </div>
                            <div>
                              <label className={labelClass}>PayPal.me Link</label>
                              <input
                                className={inputClass}
                                value={method.paypalMe || ""}
                                onChange={(e) =>
                                  updatePaymentMethod(method.id, { paypalMe: e.target.value })
                                }
                                placeholder="https://paypal.me/yourname"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Hosted Payment Link (Optional)</label>
                  <input
                    className={inputClass}
                    value={payment.paymentLink}
                    onChange={(e) => setPayment({ ...payment, paymentLink: e.target.value })}
                    placeholder="https://paystack.com/pay/..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Payment Reference Note</label>
                  <input
                    className={inputClass}
                    value={payment.paymentNote}
                    onChange={(e) => setPayment({ ...payment, paymentNote: e.target.value })}
                    placeholder="Use invoice number as reference"
                  />
                </div>
              </div>
            </section>

            <section className={`${panelClass} p-5`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                Email Integration
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Choose the sender identity used for invoice and reminder emails. The email
                address must be allowed by your Resend setup.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Sender Name</label>
                  <input
                    className={inputClass}
                    value={emailSender.fromName}
                    onChange={(e) =>
                      setEmailSender({ ...emailSender, fromName: e.target.value })
                    }
                    placeholder="Your Business"
                  />
                </div>
                <div>
                  <label className={labelClass}>Sender Email</label>
                  <input
                    className={inputClass}
                    type="email"
                    value={emailSender.fromEmail}
                    onChange={(e) =>
                      setEmailSender({ ...emailSender, fromEmail: e.target.value })
                    }
                    placeholder="hello@yourdomain.com"
                  />
                </div>
              </div>
              <div className="mt-4">
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener"
                  className={`${insetPanelClass} flex items-center justify-between px-4 py-3 no-underline transition-all hover:border-border-hover group`}
                >
                  <div>
                    <span className="text-[13px] font-semibold text-text transition-colors group-hover:text-accent">
                      Resend
                    </span>
                    <span className="mt-0.5 block text-[11px] text-text-dim">
                      Live delivery enabled through your server key
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-success">Active</span>
                </a>
              </div>
            </section>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] animate-fade-in">
            <section className={`${panelClass} p-5`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                Add Client
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Save repeat contacts once, then drop them straight into invoice drafts.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Name *</label>
                  <input
                    className={inputClass}
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Client name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Company</label>
                  <input
                    className={inputClass}
                    value={newClient.company}
                    onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    className={inputClass}
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <input
                    className={inputClass}
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    placeholder="Billing address"
                  />
                </div>
                <button onClick={handleAddClient} className={`${primaryButtonClass} mt-1`}>
                  <Plus size={14} />
                  Add Client
                </button>
              </div>
            </section>

            <section className={`${panelClass} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                    Saved Clients
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-text-muted">
                    Billing contacts available across the invoice builder.
                  </p>
                </div>
              </div>

              {clients.length === 0 ? (
                <div className={`${insetPanelClass} mt-4 px-6 py-12 text-center`}>
                  <Users size={32} className="mx-auto mb-3 text-text-dim/30" />
                  <p className="text-[13px] text-text-dim m-0">No saved clients yet</p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
                  {clients.map((client, index) => (
                    <div
                      key={client.id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 ${
                        index !== clients.length - 1 ? "border-b border-border/80" : ""
                      }`}
                    >
                      <div>
                        <span className="text-[14px] font-semibold text-text">{client.name}</span>
                        {client.company && (
                          <span className="ml-2 text-[12px] text-text-dim">({client.company})</span>
                        )}
                        <div className="mt-0.5 text-[12px] text-text-dim">
                          {[client.email, client.phone].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteClient(client.id!)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-text-dim/30 transition-all hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "services" && (
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] animate-fade-in">
            <section className={`${panelClass} p-5`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                Add Service
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Save frequently billed items and pricing defaults for repeat work.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Service Name *</label>
                  <input
                    className={inputClass}
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    placeholder="e.g. Website Design"
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <input
                    className={inputClass}
                    value={newService.description}
                    onChange={(e) =>
                      setNewService({ ...newService, description: e.target.value })
                    }
                    placeholder="Short description"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Default Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={newService.defaultRate || ""}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          defaultRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Default Tax %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className={inputClass}
                      value={newService.defaultTax || ""}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          defaultTax: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <button onClick={handleAddService} className={`${primaryButtonClass} mt-1`}>
                  <Plus size={14} />
                  Add Service
                </button>
              </div>
            </section>

            <section className={`${panelClass} p-5`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                Saved Services
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Reusable line items available across new invoices.
              </p>

              {services.length === 0 ? (
                <div className={`${insetPanelClass} mt-4 px-6 py-12 text-center`}>
                  <Package size={32} className="mx-auto mb-3 text-text-dim/30" />
                  <p className="text-[13px] text-text-dim m-0">No saved services yet</p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
                  {services.map((service, index) => (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 ${
                        index !== services.length - 1 ? "border-b border-border/80" : ""
                      }`}
                    >
                      <div>
                        <span className="text-[14px] font-semibold text-text">{service.name}</span>
                        {service.description && (
                          <span className="ml-2 text-[12px] text-text-dim">- {service.description}</span>
                        )}
                        <div className="mt-0.5 text-[12px] text-text-dim">
                          ${service.defaultRate.toFixed(2)}
                          {service.defaultTax > 0 ? ` · ${service.defaultTax}% tax` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-text-dim/30 transition-all hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "cloud" && (
          <div className="space-y-4 animate-fade-in">
            <section className={`${panelClass} p-5`}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-accent m-0">
                Backup & Restore
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-text-muted">
                Use cloud sync to keep invoice data available across devices without relying on one browser.
              </p>
            </section>
            <CloudSyncPanel />
          </div>
        )}
      </div>
    </Shell>
  );
}
