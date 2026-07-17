import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">404 - الصفحة غير موجودة</h1>
        <p className="text-muted-foreground mb-6">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
