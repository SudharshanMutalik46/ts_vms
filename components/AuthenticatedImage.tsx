import React, { useEffect, useMemo, useState } from "react";

type Props = {
    src: string;
    alt?: string;
    className?: string;
    fallback?: React.ReactNode;
};

export default function AuthenticatedImage({
    src,
    alt = "",
    className,
    fallback,
}: Props) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    // ✅ Fix: use correct token key
    const token = useMemo(() => localStorage.getItem("vms_token"), []);

    useEffect(() => {
        let alive = true;
        let createdUrl: string | null = null;

        const run = async () => {
            try {
                setFailed(false);
                setObjectUrl(null);

                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(src, { headers });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const blob = await res.blob();
                createdUrl = URL.createObjectURL(blob);

                if (alive) setObjectUrl(createdUrl);
            } catch {
                if (alive) setFailed(true);
            }
        };

        run();

        return () => {
            alive = false;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [src, token]);

    if (failed) {
        return fallback ? <>{fallback}</> : <div className={className} />;
    }

    if (!objectUrl) {
        // lightweight placeholder
        return <div className={className} style={{ background: "#111" }} />;
    }

    return <img src={objectUrl} alt={alt} className={className} />;
}
