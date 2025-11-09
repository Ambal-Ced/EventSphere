"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQ {
  question: string;
  answer: string;
}

interface FAQsAccordionProps {
  faqs: FAQ[];
}

export function FAQsAccordion({ faqs }: FAQsAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full mb-8">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left text-lg font-medium">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

