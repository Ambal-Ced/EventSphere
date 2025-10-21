"use client";

import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Cannot export metadata from Client Component
// export const metadata: Metadata = {
//   title: "FAQs - EventSphere",
//   description: "Frequently asked questions about EventSphere's platform and services.",
// };

const faqs = [
  {
    question: "What is EventSphere?",
    answer:
      "EventSphere is a comprehensive event management platform that helps organizers create, manage, and promote events of all sizes. Our platform provides tools for ticketing, attendee management, analytics, and more.",
  },
  {
    question: "How do I create an account?",
    answer:
      "Creating an account is simple! Click the 'Register' button in the top right corner of the page, fill in your details (email, password, and username), and you're ready to start using EventSphere.",
  },
  {
    question: "Is EventSphere free to use?",
    answer:
      "EventSphere offers both free and premium features. You can create and manage basic events for free, while premium features like advanced analytics and custom branding are available with our paid plans.",
  },
  {
    question: "How do I create my first event?",
    answer:
      "After logging in, click on 'My Events' in the sidebar, then click the 'Create Event' button. Fill in your event details including title, date, location, and description. You can also add tickets, set prices, and customize your event page.",
  },
  {
    question: "Can I sell tickets through EventSphere?",
    answer:
      "Yes! EventSphere provides a secure ticketing system. You can create different ticket types, set prices, and manage sales. We handle the payment processing and ticket delivery automatically.",
  },
  {
    question: "How do attendees receive their tickets?",
    answer:
      "After purchasing, attendees receive their tickets via email. Each ticket includes a unique QR code that can be scanned at the event for check-in. Tickets can also be accessed through their EventSphere account.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept major credit cards (Visa, MasterCard, American Express), PayPal, and various digital payment methods. The available payment options may vary by region.",
  },
  {
    question: "How do I check in attendees at my event?",
    answer:
      "You can use our mobile app or web interface to scan ticket QR codes for check-in. You can also print an attendee list or manually check in guests using their name or ticket number.",
  },
  {
    question: "Can I issue refunds for tickets?",
    answer:
      "Yes, organizers can issue full or partial refunds through their event dashboard up until the event date. Refund policies can be customized for each event.",
  },
  {
    question: "Does EventSphere work for virtual events?",
    answer:
      "Absolutely! EventSphere supports virtual events with features like streaming integration, virtual networking rooms, and digital content delivery. You can manage virtual attendees just like in-person events.",
  },
];

export default function FAQsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <h1 className="text-4xl font-bold text-center mb-4">
        Frequently Asked Questions
      </h1>
      <p className="text-lg text-muted-foreground text-center mb-8">
        Have questions about EventSphere? Find answers to commonly asked
        questions below. If you can't find what you're looking for, please
        contact our support team.
      </p>

      <Accordion type="single" collapsible className="w-full mb-8">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left text-lg font-medium">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="bg-muted/30 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
        <p className="text-muted-foreground mb-6">
          If you couldn't find the answer to your question, please don't
          hesitate to reach out to our support team. We're here to help!
        </p>
        <div className="flex justify-center gap-4">
          <a href="mailto:trybyteanalytics@gmail.com">
            <Button variant="default">Email Support</Button>
          </a>
          <a href="/about#contact">
            <Button variant="outline">Contact Us</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
