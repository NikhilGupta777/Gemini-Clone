import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  Database, 
  UploadCloud, 
  FileText, 
  Trash2, 
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  File
} from "lucide-react";
import { 
  useListDocuments, 
  useUploadDocument, 
  useDeleteDocument 
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function KnowledgeBasePage() {
  const { data: documents = [], isLoading } = useListDocuments();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null);
    
    if (rejectedFiles.length > 0) {
      setUploadError("File type not supported or file too large (max 10MB).");
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    try {
      await uploadDoc.mutateAsync({
        data: { file, name: file.name }
      });
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload document");
    }
  }, [uploadDoc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  const handleDelete = async (id: number) => {
    if (confirm("Remove this document from the knowledge base?")) {
      await deleteDoc.mutateAsync({ id });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="text-red-400" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return <FileSpreadsheet className="text-emerald-400" />;
    return <File className="text-blue-400" />;
  };

  return (
    <Layout>
      <div className="h-full overflow-y-auto px-4 md:px-8 py-8 md:py-12 pb-32">
        <div className="max-w-5xl mx-auto space-y-10">
          
          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Upload company documents, PDFs, and spreadsheets. The AI will securely use these as its source of truth to answer questions.
            </p>
          </div>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group flex flex-col items-center justify-center w-full p-12 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden",
              isDragActive 
                ? "border-primary bg-primary/5 scale-[1.01]" 
                : "border-border/60 bg-card hover:border-primary/50 hover:bg-card/80 hover:shadow-xl hover:shadow-primary/5",
              uploadDoc.isPending && "pointer-events-none opacity-70"
            )}
          >
            <input {...getInputProps()} />
            
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {uploadDoc.isPending ? (
              <div className="flex flex-col items-center gap-4 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="font-medium text-lg animate-pulse">Uploading & Processing Document...</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-lg border border-border group-hover:scale-110 transition-transform duration-500">
                  <UploadCloud className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Click to upload or drag and drop</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  PDF, DOCX, TXT, CSV, or XLSX (max 10MB)
                </p>
              </>
            )}
          </div>

          {uploadError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-medium"
            >
              <AlertCircle size={20} />
              {uploadError}
            </motion.div>
          )}

          {/* Documents List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Indexed Documents
                <span className="px-2.5 py-0.5 rounded-full bg-secondary text-sm font-semibold text-foreground border border-border">
                  {documents.length}
                </span>
              </h2>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 rounded-2xl bg-card border border-border animate-pulse" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground/70">No documents yet</h3>
                <p className="text-muted-foreground mt-2">Upload your first document to power the AI.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group relative flex flex-col p-5 rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-xl hover:border-border transition-all duration-300"
                    >
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleteDoc.isPending}
                        className="absolute top-4 right-4 p-2 rounded-lg bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all z-10 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-background border border-border/50 shadow-inner">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <h3 className="font-semibold text-foreground truncate" title={doc.name}>
                            {doc.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatBytes(doc.size)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Database size={12} className="text-primary/70" />
                          {doc.chunkCount} chunks indexed
                        </span>
                        <span>
                          {format(new Date(doc.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
