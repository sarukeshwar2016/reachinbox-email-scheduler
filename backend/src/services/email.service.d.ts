export declare const sendEmail: (to: string, subject: string, body: string, senderEmail: string) => Promise<{
    success: boolean;
    messageId: any;
    previewUrl: string | false;
    error?: never;
} | {
    success: boolean;
    error: string;
    messageId?: never;
    previewUrl?: never;
}>;
//# sourceMappingURL=email.service.d.ts.map