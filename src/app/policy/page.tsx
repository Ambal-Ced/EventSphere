import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policy & Terms - EventTria",
  description: "EventTria's policy and terms of service",
};

export default function PolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-8">Policy & Terms of Service</h1>
        
        <div className="bg-muted/10 rounded-lg p-6 space-y-6 text-sm text-muted-foreground">
          <p>
            Placeholder terms. This box will contain your full legal text. It is
            intentionally verbose so you can verify the scrolling behavior. Feel
            free to replace every paragraph here with your actual Terms and
            Conditions later.
          </p>
          
          <div className="space-y-4">
            <p>
              <strong>1)</strong> You agree to abide by the platform rules, community guidelines,
              and any policy updates that we may publish from time to time. You
              understand that failure to comply can result in limitations or
              removal of access.
            </p>
            
            <p>
              <strong>2)</strong> You consent to receive transactional communications that are
              necessary for account security, service notifications, receipts,
              and changes in policy. Marketing emails, if any, will always include
              opt‑out controls.
            </p>
            
            <p>
              <strong>3)</strong> You are responsible for the confidentiality of your credentials
              and for all activity that occurs under your account. Use strong
              passwords and do not share them. Promptly notify us of any suspected
              unauthorized use or security incident.
            </p>
            
            <p>
              <strong>4)</strong> You warrant that any content you submit is accurate, lawful,
              and that you hold the necessary rights and permissions. You agree
              not to upload content that infringes intellectual property, violates
              privacy, or contains malware, harassment, or illegal material.
            </p>
            
            <p>
              <strong>5)</strong> The service is provided on an "as is" and "as available" basis
              without warranties of any kind, either express or implied. We do
              not guarantee uninterrupted availability, error‑free operation, or
              that defects will be corrected.
            </p>
            
            <p>
              <strong>6)</strong> To the maximum extent permitted by law, our liability is limited
              to the amount you have paid for the service in the preceding twelve
              months, and we are not liable for indirect, incidental, special,
              consequential, or exemplary damages.
            </p>
            
            <p>
              <strong>7)</strong> By continuing, you acknowledge that you have read, understood,
              and agreed to these Terms and any referenced policies. These
              placeholders exist solely so you can test the UI; please replace
              them with your official legal copy before launch.
            </p>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> These are placeholder terms and conditions. Please replace them with your official legal copy before launching your application.
          </p>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
