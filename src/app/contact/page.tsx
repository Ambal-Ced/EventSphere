import { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us - EventTria",
  description: "Get in touch with EventTria. Reach out to us via email, phone, or visit our office in Lipa City, Batangas.",
  openGraph: {
    title: "Contact Us - EventTria",
    description: "Get in touch with EventTria. Reach out to us via email, phone, or visit our office in Lipa City, Batangas.",
    images: ["/images/template/eventtria.webp"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us - EventTria",
    description: "Get in touch with EventTria. Reach out to us via email, phone, or visit our office in Lipa City, Batangas.",
    images: ["/images/template/eventtria.webp"],
  },
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Contact Us
        </h1>
        <p className="text-xl text-muted-foreground">
          We'd love to hear from you. Get in touch with us through any of the following ways.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {/* Email */}
        <div className="bg-card rounded-lg p-6 border text-center">
          <div className="mb-4 flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-3">Email</h3>
          <a
            href="mailto:trybyteanalytics@gmail.com"
            className="text-primary hover:underline break-all"
          >
            trybyteanalytics@gmail.com
          </a>
        </div>

        {/* Phone */}
        <div className="bg-card rounded-lg p-6 border text-center">
          <div className="mb-4 flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Phone className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-3">Phone</h3>
          <a
            href="tel:+639391962494"
            className="text-primary hover:underline"
          >
            09391962494
          </a>
        </div>

        {/* Address */}
        <div className="bg-card rounded-lg p-6 border text-center">
          <div className="mb-4 flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-3">Address</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            X547+M66, A. Tanco Drive,<br />
            Maraouy, Lipa City,<br />
            Batangas, Philippines
          </p>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-card rounded-lg p-8 border">
        <h2 className="text-2xl font-semibold mb-4">Office Hours</h2>
        <p className="text-muted-foreground mb-6">
          Our team is available to assist you during business hours. For urgent matters, please feel free to reach out via email or phone.
        </p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Monday - Friday</span>
            <span className="text-muted-foreground">9:00 AM - 6:00 PM</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Saturday</span>
            <span className="text-muted-foreground">9:00 AM - 1:00 PM</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Sunday</span>
            <span className="text-muted-foreground">Closed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

