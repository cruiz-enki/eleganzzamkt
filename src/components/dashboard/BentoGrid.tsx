import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BentoItemProps {
  title: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function BentoItem({ title, children, className, icon }: BentoItemProps) {
  return (
    <Card className={cn("overflow-hidden border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all hover:shadow-md border border-transparent dark:border-slate-800", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[180px]", className)}>
      {children}
    </div>
  );
}
