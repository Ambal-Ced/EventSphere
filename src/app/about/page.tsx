import Link from "next/link";
import { TeamCarousel } from "@/components/ui/team-carousel";
import Image from "next/image";

// Team Member Data
const teamMembers = [
  {
    name: "Justine Cedrick Ambal",
    title: "CEO & Co-Founder",
    imageSrc: "/images/man1.webp",
    portfolioUrl: "https://www.linkedin.com/in/ambal-ced3604/",
  },
  {
    name: "Brylle Andrei Atienza",
    title: "CTO & Co-Founder",
    imageSrc: "/images/man2.webp",
    portfolioUrl: "https://portfolio.brylle.com",
  },
  {
    name: "Jude Maverick Manalo",
    title: "COO & Head of Product",
    imageSrc: "/images/man3.webp",
    portfolioUrl:
      "https://www.linkedin.com/in/jude-maverick-manalo-20880432a/",
  },
];

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">About EventTria</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          We're building the future of event management, one event at a time.
        </p>
      </div>

      {/* Mission Section */}
      <section className="mb-16">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 border border-primary/20">
          <h2 className="text-3xl font-bold mb-6 text-center">Our Mission</h2>
          <p className="text-lg leading-relaxed text-center max-w-3xl mx-auto">
            At EventTria, we believe that organizing events should be simple,
            efficient, and enjoyable. Our mission is to empower event organizers
            with powerful tools that streamline every aspect of event management,
            from planning and promotion to execution and analysis.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <p className="text-lg leading-relaxed">
              EventTria was born from a simple observation: event organizers
              were struggling with fragmented tools and complex workflows. We
              set out to create a unified platform that brings everything
              together in one place.
            </p>
            <p className="text-lg leading-relaxed">
              Today, EventTria serves thousands of event organizers worldwide,
              helping them create memorable experiences for their attendees while
              saving time and reducing stress.
            </p>
          </div>
          <div className="relative h-64 rounded-lg overflow-hidden">
            <Image
              src="/images/template/eventtria.webp"
              alt="EventTria Story"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Our Values</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Simplicity</h3>
            <p className="text-muted-foreground">
              We believe in making complex things simple. Our platform is
              intuitive and easy to use, even for first-time event organizers.
            </p>
          </div>
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Reliability</h3>
            <p className="text-muted-foreground">
              Your events are important to us. We ensure our platform is
              reliable, secure, and always available when you need it.
            </p>
          </div>
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Innovation</h3>
            <p className="text-muted-foreground">
              We're constantly improving and adding new features based on
              feedback from our community of event organizers.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Meet Our Team</h2>
        <TeamCarousel members={teamMembers} />
      </section>

      {/* Contact Section */}
      <section className="text-center">
        <div className="bg-muted/30 rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-4">Get in Touch</h2>
          <p className="text-muted-foreground mb-6">
            Have questions or feedback? We'd love to hear from you!
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
