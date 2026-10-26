import {
  Link,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";

import { api, errorMessage } from "@/api/client";
import {
  assignTicket,
  createLinkedTicket,
  fetchAgents,
  fetchMeta,
  fetchTicket,
  postComment,
  setTicketStatus,
} from "@/api/tickets";
import { useAuth } from "@/store/auth";
import type { Agent, Meta, Status, TicketDetail } from "@/types";

const statusLabel = (status: Status) =>
  status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const ticketId = Number(id);
  const validTicketId = Number.isSafeInteger(ticketId) && ticketId > 0;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [comment, setComment] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [linkDepartmentId, setLinkDepartmentId] = useState<number | null>(null);
  const [linkServiceId, setLinkServiceId] = useState<number | null>(null);
  const [linkAsset, setLinkAsset] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [agentError, setAgentError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadTicket = useCallback(async () => {
    const detail = await fetchTicket(ticketId);
    setTicket(detail);
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!validTicketId) return;
      const refresh = () =>
        fetchTicket(ticketId)
          .then((detail) => {
            if (active) {
              setTicket(detail);
              setError("");
            }
          })
          .catch((reason: unknown) => {
            if (active) setError(errorMessage(reason));
          });
      void refresh().finally(() => {
        if (active) setLoading(false);
      });
      const interval = setInterval(() => void refresh(), 30_000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [ticketId, validTicketId]),
  );

  useEffect(() => {
    if (user?.role !== "agent" && user?.role !== "admin") return;
    let active = true;
    fetchAgents()
      .then((items) => {
        if (active) setAgents(items);
      })
      .catch((reason: unknown) => {
        if (active) setAgentError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [user?.role]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchMeta()
        .then((meta) => {
          if (active) {
            setMeta(meta);
            setStatuses(meta.statuses);
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(errorMessage(reason));
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const updateTicket = async (update: () => Promise<unknown>) => {
    setSaving(true);
    setError("");
    try {
      await update();
      await loadTicket();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const assignTo = (assigneeId: number) => {
    if (ticket?.assignedTo && ticket.assignedTo.id !== assigneeId) {
      if (assignmentNote.trim().length < 3) {
        setError(
          "Add a note of at least 3 characters to explain the reassignment.",
        );
        return;
      }
    }
    void updateTicket(async () => {
      await assignTicket(
        ticketId,
        assigneeId,
        assignmentNote.trim() || undefined,
      );
      setAssignmentNote("");
    });
  };

  const submitLinkedTicket = async () => {
    const selectedService = meta?.services.find(
      (service) =>
        service.id === linkServiceId &&
        service.departmentId === linkDepartmentId,
    );
    if (!ticket || !linkDepartmentId || !selectedService) {
      setError("Choose a target department and one of its services.");
      return;
    }
    if (!linkNote.trim()) {
      setError(
        "Add a note explaining the work requested from the other department.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const linked = await createLinkedTicket(ticket.id, {
        categoryId: selectedService.categoryId,
        serviceId: selectedService.id,
        departmentId: selectedService.departmentId,
        asset: linkAsset.trim() || ticket.asset,
        description: linkDescription.trim() || undefined,
        priority: ticket.priority,
        note: linkNote.trim(),
      });
      await loadTicket();
      setLinkDepartmentId(null);
      setLinkServiceId(null);
      setLinkAsset("");
      setLinkDescription("");
      setLinkNote("");
      router.push(`/ticket/${linked.id}` as any);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const downloadAttachment = async (
    attachment: TicketDetail["attachments"][number],
  ) => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setError(
        "Secure attachment download is currently available in the web app only.",
      );
      return;
    }
    setDownloadingId(attachment.id);
    setError("");
    try {
      const response = await api.get<Blob>(attachment.url, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name || `ticket-${ticket?.code}-attachment`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setDownloadingId(null);
    }
  };

  const canAssign =
    user?.role === "admin" ||
    (user?.role === "agent" && user.departmentId === ticket?.departmentId);
  const canLink = user?.role === "admin" || user?.role === "agent";
  const canChangeStatus =
    user?.role === "admin" || ticket?.assignedTo?.id === user?.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Ticket details">
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.navLink}>← Back</Text>
          </Pressable>
          <Link href="/" replace asChild>
            <Pressable>
              <Text style={styles.navLink}>Dashboard</Text>
            </Pressable>
          </Link>
        </ScreenHeader>

        {!validTicketId ? (
          <Text style={styles.error}>Invalid ticket ID.</Text>
        ) : null}
        {validTicketId && loading ? (
          <Text style={styles.message}>Loading ticket details…</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {validTicketId && !loading && !ticket && !error ? (
          <Text style={styles.message}>Ticket not found.</Text>
        ) : null}

        {ticket ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Ticket details</Text>
              <Text style={styles.code}>{ticket.code}</Text>
              <Text style={styles.asset}>{ticket.asset}</Text>
              <View style={styles.badges}>
                <Text style={styles.badge}>{statusLabel(ticket.status)}</Text>
                <Text style={styles.badge}>
                  {ticket.priority.toUpperCase()} PRIORITY
                </Text>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Request information</Text>
              <Detail
                label="Description"
                value={ticket.description || "No description provided"}
              />
              <Detail label="Category" value={ticket.category} />
              <Detail label="Service" value={ticket.service} />
              <Detail label="Department" value={ticket.department} />
              {ticket.parentTicket ? (
                <Link href={`/ticket/${ticket.parentTicket.id}` as any} asChild>
                  <Pressable>
                    <Detail
                      label="Linked from"
                      value={`${ticket.parentTicket.code} · Ticket ID ${ticket.parentTicket.id}`}
                    />
                  </Pressable>
                </Link>
              ) : null}
              <Detail
                label="Location"
                value={
                  [
                    ticket.location.block,
                    ticket.location.floor,
                    ticket.location.room,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "Not specified"
                }
              />
              <Detail
                label="Expected close"
                value={
                  ticket.expectedClosingDays
                    ? `${ticket.expectedClosingDays} days`
                    : "Not specified"
                }
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>People and access</Text>
              <Detail
                label="Raised by"
                value={`${ticket.createdBy.name} (${ticket.createdBy.empId})`}
              />
              <Detail
                label="Assigned to"
                value={
                  ticket.assignedTo
                    ? `${ticket.assignedTo.name} (${ticket.assignedTo.empId})`
                    : "Unassigned"
                }
              />
              {ticket.resolverOnLeave ? (
                <Text style={styles.resolverLeaveNote}>
                  {ticket.resolverOnLeave.name} is on leave through{" "}
                  {ticket.resolverOnLeave.endDate}.{" "}
                  {ticket.assignedTo
                    ? `${ticket.assignedTo.name} is covering this ticket.`
                    : "No covering resolver is available yet."}
                </Text>
              ) : null}
              <Text style={styles.accessNote}>
                Customers can view tickets they raised. Agents can view tickets
                assigned to them or in their department. Administrators can view
                all tickets.
              </Text>

              {canAssign ? (
                <View style={styles.actionBlock}>
                  <Text style={styles.fieldLabel}>
                    Assign to a department agent
                  </Text>
                  {agentError ? (
                    <Text style={styles.error}>{agentError}</Text>
                  ) : null}
                  <Text style={styles.message}>
                    Agents with fewer active tickets are prioritized for
                    automatic assignment.
                  </Text>
                  {agents
                    .filter(
                      (agent) =>
                        agent.departmentId === ticket.departmentId &&
                        !agent.onLeave,
                    )
                    .map((agent) => (
                      <Pressable
                        key={agent.id}
                        disabled={saving || ticket.assignedTo?.id === agent.id}
                        onPress={() => assignTo(agent.id)}
                        style={[
                          styles.actionButton,
                          ticket.assignedTo?.id === agent.id &&
                            styles.selectedButton,
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            ticket.assignedTo?.id === agent.id &&
                              styles.selectedText,
                          ]}
                        >
                          {ticket.assignedTo?.id === agent.id
                            ? `Assigned: ${agent.name} · ${agent.activeTicketCount} active`
                            : agent.id === user?.id
                              ? `Assign to yourself · ${agent.activeTicketCount} active`
                              : `Assign to ${agent.name} · ${agent.activeTicketCount} active`}
                        </Text>
                      </Pressable>
                    ))}
                  {ticket.assignedTo ? (
                    <>
                      <Text style={styles.fieldLabel}>
                        Reassignment note (required when changing assignee)
                      </Text>
                      <TextInput
                        value={assignmentNote}
                        onChangeText={setAssignmentNote}
                        maxLength={500}
                        multiline
                        placeholder="Explain why this ticket needs to move to another resolver"
                        style={styles.commentInput}
                      />
                    </>
                  ) : null}
                  {agents.filter(
                    (agent) => agent.departmentId === ticket.departmentId,
                  ).length === 0 ? (
                    <Text style={styles.message}>
                      No agents are available in this department.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {canChangeStatus ? (
                <View style={styles.actionBlock}>
                  <Text style={styles.fieldLabel}>Update status</Text>
                  {statuses.map((status) => (
                    <Pressable
                      key={status}
                      disabled={saving || ticket.status === status}
                      onPress={() =>
                        void updateTicket(() =>
                          setTicketStatus(ticket.id, status),
                        )
                      }
                      style={[
                        styles.actionButton,
                        ticket.status === status && styles.selectedButton,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          ticket.status === status && styles.selectedText,
                        ]}
                      >
                        {status === ticket.status
                          ? `Current: ${statusLabel(status)}`
                          : statusLabel(status)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Related department work ({ticket.linkedTickets.length})
              </Text>
              {ticket.linkedTickets.map((linked) => (
                <View key={linked.id} style={styles.listEntry}>
                  <Link href={`/ticket/${linked.id}` as any} asChild>
                    <Pressable>
                      <Text style={styles.entryTitle}>
                        {linked.code} · {linked.department}
                      </Text>
                    </Pressable>
                  </Link>
                  <Text style={styles.entryBody}>
                    Status: {statusLabel(linked.status)} · {linked.note}
                  </Text>
                  <Text style={styles.entryTime}>
                    Linked by {linked.createdBy.name}
                    {linked.createdAt
                      ? ` · ${formatDate(linked.createdAt)}`
                      : ""}
                  </Text>
                </View>
              ))}
              {ticket.linkedTickets.length === 0 ? (
                <Text style={styles.message}>
                  No tickets have been linked to another department.
                </Text>
              ) : null}
              {canLink ? (
                <View style={styles.actionBlock}>
                  <Text style={styles.fieldLabel}>
                    Create a ticket for another department
                  </Text>
                  <Text style={styles.message}>
                    The new ticket is routed to the least-loaded resolver in the
                    selected department. Its progress will appear here.
                  </Text>
                  {(meta?.departments ?? [])
                    .filter(
                      (department) => department.id !== ticket.departmentId,
                    )
                    .map((department) => (
                      <Pressable
                        key={department.id}
                        onPress={() => {
                          setLinkDepartmentId(department.id);
                          setLinkServiceId(null);
                        }}
                        style={[
                          styles.actionButton,
                          linkDepartmentId === department.id &&
                            styles.selectedButton,
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            linkDepartmentId === department.id &&
                              styles.selectedText,
                          ]}
                        >
                          {department.name}
                        </Text>
                      </Pressable>
                    ))}
                  {linkDepartmentId ? (
                    <>
                      <Text style={styles.fieldLabel}>Target service</Text>
                      {(meta?.services ?? [])
                        .filter(
                          (service) =>
                            service.departmentId === linkDepartmentId,
                        )
                        .map((service) => (
                          <Pressable
                            key={service.id}
                            onPress={() => setLinkServiceId(service.id)}
                            style={[
                              styles.actionButton,
                              linkServiceId === service.id &&
                                styles.selectedButton,
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionText,
                                linkServiceId === service.id &&
                                  styles.selectedText,
                              ]}
                            >
                              {service.name}
                            </Text>
                          </Pressable>
                        ))}
                      <TextInput
                        value={linkAsset}
                        onChangeText={setLinkAsset}
                        maxLength={120}
                        placeholder={`Work item (defaults to ${ticket.asset})`}
                        style={styles.commentInput}
                      />
                      <TextInput
                        value={linkDescription}
                        onChangeText={setLinkDescription}
                        maxLength={2000}
                        multiline
                        placeholder="Additional details for the receiving department"
                        style={styles.commentInput}
                      />
                      <TextInput
                        value={linkNote}
                        onChangeText={setLinkNote}
                        maxLength={500}
                        multiline
                        placeholder="Required: explain why this work is being linked"
                        style={styles.commentInput}
                      />
                      <Pressable
                        disabled={saving}
                        onPress={() => void submitLinkedTicket()}
                        style={[
                          styles.primaryButton,
                          saving && styles.disabledButton,
                        ]}
                      >
                        <Text style={styles.primaryText}>
                          {saving
                            ? "Creating linked ticket…"
                            : "Create linked ticket"}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Dates</Text>
              <Detail label="Created" value={formatDate(ticket.createdAt)} />
              <Detail
                label="Last updated"
                value={formatDate(ticket.updatedAt)}
              />
              <Detail label="Resolved" value={formatDate(ticket.resolvedAt)} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Attachments ({ticket.attachments.length})
              </Text>
              {ticket.attachments.map((attachment) => (
                <View key={attachment.id} style={styles.attachmentRow}>
                  <Text style={styles.listItem}>
                    {attachment.name || "Image attachment"} •{" "}
                    {attachment.mimetype || "file"}
                  </Text>
                  {Platform.OS === "web" ? (
                    <Pressable
                      disabled={downloadingId === attachment.id}
                      onPress={() => void downloadAttachment(attachment)}
                      style={styles.downloadButton}
                    >
                      <Text style={styles.downloadText}>
                        {downloadingId === attachment.id
                          ? "Downloading…"
                          : "Download"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {ticket.attachments.length === 0 ? (
                <Text style={styles.message}>No attachments.</Text>
              ) : null}
              <Text style={styles.accessNote}>
                Attachment access is protected by the same ticket permissions.
                Secure downloads are available in the web app.
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Comments ({ticket.comments.length})
              </Text>
              {ticket.comments.map((item) => (
                <View key={item.id} style={styles.listEntry}>
                  <Text style={styles.entryTitle}>
                    {item.author.name} · {item.author.role}
                  </Text>
                  <Text style={styles.entryBody}>{item.body}</Text>
                  <Text style={styles.entryTime}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              ))}
              {ticket.comments.length === 0 ? (
                <Text style={styles.message}>No comments yet.</Text>
              ) : null}
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add an update (up to 1000 characters)"
                maxLength={1000}
                multiline
                style={styles.commentInput}
              />
              <Pressable
                disabled={saving || !comment.trim()}
                onPress={() =>
                  void updateTicket(async () => {
                    await postComment(ticket.id, comment.trim());
                    setComment("");
                  })
                }
                style={[
                  styles.primaryButton,
                  (saving || !comment.trim()) && styles.disabledButton,
                ]}
              >
                <Text style={styles.primaryText}>
                  {saving ? "Saving…" : "Post comment"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Activity timeline ({ticket.timeline.length})
              </Text>
              {ticket.timeline.map((item) => (
                <View key={item.id} style={styles.listEntry}>
                  <Text style={styles.entryTitle}>
                    {item.action}
                    {item.detail ? ` · ${item.detail}` : ""}
                  </Text>
                  <Text style={styles.entryBody}>
                    {item.actor.name} ({item.actor.empId})
                  </Text>
                  <Text style={styles.entryTime}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              ))}
              {ticket.timeline.length === 0 ? (
                <Text style={styles.message}>No activity recorded.</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6fa" },
  container: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  navLink: { color: "#38539b", fontWeight: "800", padding: 8 },
  hero: {
    borderRadius: 18,
    padding: 22,
    backgroundColor: "#203b70",
    shadowColor: "#23365b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  eyebrow: {
    color: "#dce7ff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  code: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 8 },
  asset: { color: "#fff", fontSize: 27, fontWeight: "900", marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  badge: {
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e7ebf3",
  },
  panelTitle: {
    color: "#17264b",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f8",
    paddingVertical: 9,
  },
  detailLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  detailValue: { color: "#172033", fontSize: 14, marginTop: 4, lineHeight: 20 },
  accessNote: {
    color: "#53627b",
    backgroundColor: "#f3f6ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  resolverLeaveNote: {
    color: "#9a5a12",
    backgroundColor: "#fff7e6",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  actionBlock: { marginTop: 18, gap: 8 },
  fieldLabel: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#d9e2f5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedButton: { backgroundColor: "#eaf1ff", borderColor: "#92b2ff" },
  actionText: { color: "#25406b", fontWeight: "700", fontSize: 13 },
  selectedText: { color: "#1748b8" },
  listEntry: {
    borderTopWidth: 1,
    borderTopColor: "#eef1f7",
    paddingVertical: 12,
  },
  listItem: {
    color: "#263349",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef1f7",
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  downloadButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#edf3ff",
  },
  downloadText: { color: "#1f5cff", fontWeight: "800", fontSize: 12 },
  entryTitle: {
    color: "#1f2937",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 19,
  },
  entryBody: { color: "#526078", fontSize: 13, lineHeight: 19, marginTop: 3 },
  entryTime: { color: "#7a879a", fontSize: 11, marginTop: 5 },
  commentInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#dfe6f4",
    backgroundColor: "#fbfcff",
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
    marginTop: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f5cff",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  disabledButton: { opacity: 0.5 },
  primaryText: { color: "#fff", fontWeight: "800" },
  message: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 6,
  },
  error: {
    color: "#b42318",
    backgroundColor: "#fff1f0",
    padding: 12,
    borderRadius: 12,
    lineHeight: 19,
  },
});
