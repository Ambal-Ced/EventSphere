"use client"; // Make it a Client Component

import { useState, useEffect } from "react"; // Import hooks
import { Metadata } from "next";
import { cn } from "@/lib/utils"; // Import cn if needed for conditional classes
import Link from "next/link";

// Cannot export metadata from Client Component
// export const metadata: Metadata = {
//   title: "About EventSphere",
//   description:
//     "Learn more about EventSphere's mission, story, values, team, and how to contact us.",
// };

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
    title: "Head of Product",
    imageSrc: "/images/man3.webp",
    portfolioUrl:
      "https://www.linkedin.com/in/jude-maverick-manalo-20880432a/",
  },
];

export default function AboutPage() {
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);

  // Effect to cycle through team members
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMemberIndex(
        (prevIndex) => (prevIndex + 1) % teamMembers.length
      );
    }, 4000); // Change member every 4 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array ensures effect runs only once on mount

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <h1 className="text-center text-4xl font-bold mb-12">
        About EventSphere
      </h1>

      {/* Mission Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-4">Our Mission</h2>
        <p className="text-lg text-muted-foreground mb-4">
          At EventSphere, we're committed to transforming how people create,
          manage, and experience events. Our mission is to provide a seamless
          platform that connects event organizers with attendees, making the
          entire event lifecycle simple and enjoyable.
        </p>
        <p className="text-lg text-muted-foreground">
          We believe that everyone should have access to powerful event
          management tools, whether you're organizing a small meetup or a large
          conference. Our platform is designed to be intuitive, flexible, and
          powerful enough to handle events of any size.
        </p>
      </section>

      {/* Story Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-4">Our Story</h2>
        <p className="text-lg text-muted-foreground mb-4">
          EventSphere was founded in 2024 by a group of passionate event
          planners and technology enthusiasts who saw a gap in the market for a
          truly comprehensive event management solution.
        </p>
        <p className="text-lg text-muted-foreground mb-4">
          After years of managing events using multiple disconnected tools, our
          founders came together to create a single platform that handles
          everything from event creation and promotion to ticketing and
          analytics.
        </p>
        <p className="text-lg text-muted-foreground">
          Today, EventSphere is used by thousands of event organizers worldwide,
          helping them create memorable experiences for their attendees while
          simplifying the behind-the-scenes work.
        </p>
      </section>

      {/* Values Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-8">Our Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-lg hover:bg-green-500/20 hover:border-green-500/40 hover:scale-105 transition-all duration-300 cursor-pointer">
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Simplicity
            </h3>
            <p className="text-green-300">
              We believe technology should make life easier, not more
              complicated. Our platform is designed to be intuitive and easy to
              use, without sacrificing power or flexibility.
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/40 hover:scale-105 transition-all duration-300 cursor-pointer">
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Innovation
            </h3>
            <p className="text-amber-300">
              We're constantly exploring new ways to improve the event
              experience, from enhanced analytics to virtual event integration.
            </p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-lg hover:bg-green-500/20 hover:border-green-500/40 hover:scale-105 transition-all duration-300 cursor-pointer">
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Community
            </h3>
            <p className="text-green-300">
              We're building more than just a platform; we're creating a
              community of event professionals who share ideas, best practices,
              and support each other.
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/40 hover:scale-105 transition-all duration-300 cursor-pointer">
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Reliability
            </h3>
            <p className="text-amber-300">
              Events are time-sensitive, and we understand the importance of a
              reliable platform. We're committed to providing a service you can
              count on, every time.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section - 3D Carousel */}
      <section className="mb-16">
        <h2 className="text-4xl font-semibold mb-6 text-center">The Team</h2>
        <p className="text-xl text-muted-foreground mb-16 text-center max-w-3xl mx-auto">
          Our diverse team brings together expertise in event management,
          software development, user experience design, and customer support.
          We're united by our passion for creating exceptional event
          experiences.
        </p>
        {/* 3D Carousel */}
        <div className="relative flex items-center justify-center h-96 w-full mb-12 mt-560">
          {teamMembers.map((member, index) => {
            // Calculate position relative to the current member
            const offset = index - currentMemberIndex;
            let style =
              "absolute top-1/2 left-1/2 transition-all duration-700 ease-in-out flex flex-col items-center";
            let zIndex = 10 - Math.abs(offset);
            let opacity = 1;
            let transform = "";
            if (offset === 0) {
              // Center card: bigger and a little above
              transform = "-translate-x-1/2 -translate-y-[70%] scale-105";
              zIndex = 20;
              opacity = 1;
            } else if (
              offset === -1 ||
              (offset === teamMembers.length - 1 && currentMemberIndex === 0)
            ) {
              // Left card: smaller and a little lower
              transform =
                "-translate-x-[110%] translate-y-[10%] scale-90 rotate-y-8";
              opacity = 0.7;
            } else if (
              offset === 1 ||
              (offset === -(teamMembers.length - 1) &&
                currentMemberIndex === teamMembers.length - 1)
            ) {
              // Right card: smaller and a little lower
              transform =
                "translate-x-[10%] translate-y-[10%] scale-90 -rotate-y-8";
              opacity = 0.7;
            } else {
              // Hide other cards
              opacity = 0;
              zIndex = 0;
            }
            return (
              <div
                key={member.name}
                className={`${style} w-64`}
                style={{
                  zIndex,
                  opacity,
                  pointerEvents: offset === 0 ? "auto" : "none",
                  transform: `translate(-50%, -50%) ${
                    offset === 0
                      ? "scale(1.05)"
                      : offset === -1 ||
                        (offset === teamMembers.length - 1 &&
                          currentMemberIndex === 0)
                      ? "translateX(-115%) translateY(10%) scale(0.9) rotateY(8deg)"
                      : offset === 1 ||
                        (offset === -(teamMembers.length - 1) &&
                          currentMemberIndex === teamMembers.length - 1)
                      ? "translateX(115%) translateY(10%) scale(0.9) rotateY(-8deg)"
                      : "scale(0.7)"
                  }`,
                  transition: "all 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <Link
                  href={member.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-full group"
                >
                  <div className="mx-auto h-48 w-48 rounded-2xl bg-muted mb-4 overflow-hidden flex items-center justify-center shadow-xl border-4 border-background group-hover:scale-105 transition-transform">
                    {member.imageSrc && (
                      <img
                        src={member.imageSrc}
                        alt={member.name}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="w-full">
                    <h3 className="text-xl font-semibold mb-1 text-center text-primary whitespace-nowrap max-w-full overflow-x-auto group-hover:underline">
                      {member.name}
                    </h3>
                    <p className="text-lg text-muted-foreground text-center">
                      {member.title}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact">
        <h2 className="text-3xl font-semibold mb-4">Contact Us</h2>
        <p className="text-lg text-muted-foreground mb-6">
          We'd love to hear from you! Whether you have questions about our
          platform, need help with your account, or want to share feedback, our
          team is here to help.
        </p>
        <div className="bg-muted/30 p-6 rounded-lg">
          <p className="mb-2">
            <span className="font-semibold">Email:</span>{" "}
            <a
              href="mailto:trybyteanalytics@gmail.com"
              className="text-green-500 hover:underline"
            >
              trybyteanalytics@gmail.com
            </a>
          </p>
          <p className="mb-2">
            <span className="font-semibold">Phone:</span> (123) 456-7890
          </p>
          <p>
            <span className="font-semibold">Address:</span> 123 Event Street,
            San Francisco, CA 94103
          </p>
        </div>
      </section>
    </div>
  );
}
