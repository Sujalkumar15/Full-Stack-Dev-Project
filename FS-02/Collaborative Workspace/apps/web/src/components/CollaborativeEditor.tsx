import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useQuery } from '@tanstack/react-query';
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { ApiError, getCollaborationCredentials, type CollaborationCredentials } from '../lib/api';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type SaveStatus = 'Connecting…' | 'Syncing…' | 'Saved' | 'Offline' | 'Read only';

interface CollaborationRuntime {
  credentials: CollaborationCredentials;
  document: Y.Doc;
  provider: WebsocketProvider;
}

interface Participant {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
}

function websocketBaseUrl(endpoint: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${endpoint}`;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'bg-stone-900 text-white'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}

function EditorRuntime({ runtime }: { runtime: CollaborationRuntime }) {
  const { credentials, document, provider } = runtime;
  const editable = credentials.access === 'EDIT' || credentials.access === 'MANAGE';
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Connecting…');
  const [participants, setParticipants] = useState<Participant[]>([]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          heading: { levels: [1, 2, 3] },
          link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
        }),
        Collaboration.configure({ document, field: 'default' }),
        CollaborationCaret.configure({
          provider,
          user: credentials.user,
        }),
      ],
      editable,
      enableContentCheck: true,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class: 'tiptap collaborative-editor-content',
          'aria-label': editable ? 'Collaborative document editor' : 'Read-only document',
        },
      },
    },
    [document, provider, editable],
  );

  useEffect(() => {
    const updateParticipants = () => {
      const byUserId = new Map<string, Participant>();
      for (const state of provider.awareness.getStates().values()) {
        const user = (state as { user?: Participant }).user;
        if (user?.id && user.name && user.color) byUserId.set(user.id, user);
      }
      setParticipants(Array.from(byUserId.values()));
    };
    const handleStatus = ({ status }: { status: ConnectionStatus }) => {
      setConnectionStatus(status);
      if (status === 'connected') setSaveStatus(editable ? 'Syncing…' : 'Read only');
      if (status === 'disconnected') setSaveStatus('Offline');
    };
    const handleSync = (synced: boolean) => {
      if (synced) setSaveStatus(editable ? 'Saved' : 'Read only');
    };
    const handleDocumentUpdate = (_update: Uint8Array, origin: unknown) => {
      if (editable && origin !== provider) setSaveStatus('Syncing…');
    };

    provider.on('status', handleStatus);
    provider.on('sync', handleSync);
    provider.awareness.on('change', updateParticipants);
    document.on('update', handleDocumentUpdate);
    updateParticipants();

    return () => {
      provider.off('status', handleStatus);
      provider.off('sync', handleSync);
      provider.awareness.off('change', updateParticipants);
      document.off('update', handleDocumentUpdate);
    };
  }, [document, editable, provider]);

  useEffect(() => {
    let attachedSocket: WebSocket | null = null;
    const handlePersistedMessage = (event: MessageEvent) => {
      if (!editable || !(event.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(event.data);
      if (bytes[0] === 0) setSaveStatus('Saved');
    };
    const attachToSocket = () => {
      const socket = provider.ws;
      if (!socket || socket === attachedSocket) return;
      attachedSocket?.removeEventListener('message', handlePersistedMessage);
      attachedSocket = socket;
      socket.addEventListener('message', handlePersistedMessage);
    };
    const handleStatus = ({ status }: { status: ConnectionStatus }) => {
      if (status === 'connected') attachToSocket();
    };
    provider.on('status', handleStatus);
    attachToSocket();
    return () => {
      provider.off('status', handleStatus);
      attachedSocket?.removeEventListener('message', handlePersistedMessage);
    };
  }, [editable, provider]);

  const participantLabel = useMemo(
    () =>
      participants.length === 1 ? '1 person online' : `${participants.length || 1} people online`,
    [participants.length],
  );

  function editLink() {
    if (!editor || !editable) return;
    const current = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL', current ?? 'https://');
    if (href === null) return;
    if (href.trim() === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  if (!editor) {
    return (
      <div className="grid min-h-72 place-items-center text-sm text-stone-500">
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Preparing editor…
        </span>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex min-h-12 items-center gap-1 border-b border-stone-200 px-2 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2">
          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor.isActive('underline')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <Underline className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          <ToolbarButton
            label="Heading 1"
            active={editor.isActive('heading', { level: 1 })}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            active={editor.isActive('bulletList')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={editor.isActive('orderedList')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Blockquote"
            active={editor.isActive('blockquote')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Code block"
            active={editor.isActive('codeBlock')}
            disabled={!editable}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={editor.isActive('link')}
            disabled={!editable}
            onClick={editLink}
          >
            <Link2 className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          <ToolbarButton
            label="Undo"
            disabled={!editable || !editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!editable || !editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </ToolbarButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span
            className={`size-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500'
                : connectionStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
            }`}
          />
          {saveStatus}
        </div>
        <div className="flex items-center gap-2" title={participantLabel}>
          <div className="flex -space-x-2">
            {(participants.length ? participants : [credentials.user]).slice(0, 5).map((person) => (
              <span
                key={person.id}
                className="grid size-7 place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
                style={{ backgroundColor: person.color }}
                title={person.name}
              >
                {person.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
          <span className="hidden text-xs text-stone-500 sm:block">{participantLabel}</span>
        </div>
      </div>

      {!editable ? (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          You have read-only access to this document.
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export function CollaborativeEditor({
  workspaceId,
  pageId,
}: {
  workspaceId: string;
  pageId: string;
}) {
  const [credentialGeneration, setCredentialGeneration] = useState(0);
  const [runtime, setRuntime] = useState<CollaborationRuntime | null>(null);
  const credentials = useQuery({
    queryKey: ['collaboration-credentials', workspaceId, pageId, credentialGeneration],
    queryFn: () => getCollaborationCredentials(workspaceId, pageId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!credentials.data) return;
    const document = new Y.Doc();
    const provider = new WebsocketProvider(
      websocketBaseUrl(credentials.data.endpoint),
      pageId,
      document,
      {
        params: { token: credentials.data.token },
        disableBc: true,
        resyncInterval: 10_000,
        maxBackoffTime: 5_000,
      },
    );
    const runtimeValue = { credentials: credentials.data, document, provider };
    setRuntime(runtimeValue);

    let refreshingCredentials = false;
    const handleClose = (event: CloseEvent | null) => {
      if (!event || (event.code !== 4401 && event.code !== 4403) || refreshingCredentials) return;
      refreshingCredentials = true;
      provider.shouldConnect = false;
      provider.disconnect();
      setRuntime(null);
      setCredentialGeneration((generation) => generation + 1);
    };
    provider.on('connection-close', handleClose);

    return () => {
      provider.off('connection-close', handleClose);
      provider.destroy();
      document.destroy();
    };
  }, [credentials.data, pageId]);

  if (credentials.isLoading || (!runtime && !credentials.isError)) {
    return (
      <div className="mt-8 grid min-h-72 place-items-center rounded-2xl border border-stone-200 bg-white text-sm text-stone-500">
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Connecting to the document…
        </span>
      </div>
    );
  }

  if (credentials.isError) {
    const message =
      credentials.error instanceof ApiError
        ? credentials.error.message
        : 'Unable to start collaboration.';
    return (
      <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
        <p className="text-sm font-medium text-rose-800">{message}</p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-rose-700 underline"
          onClick={() => setCredentialGeneration((generation) => generation + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  return runtime ? <EditorRuntime runtime={runtime} /> : null;
}
