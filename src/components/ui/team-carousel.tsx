"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface TeamMember {
  name: string;
  title: string;
  imageSrc: string;
  portfolioUrl: string;
}

interface TeamCarouselProps {
  members: TeamMember[];
}

export function TeamCarousel({ members }: TeamCarouselProps) {
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);

  // Effect to cycle through team members
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentMemberIndex((prevIndex) => (prevIndex + 1) % members.length);
    }, 4000); // Change member every 4 seconds

    return () => clearInterval(intervalId);
  }, [members.length]);

  const currentMember = members[currentMemberIndex];

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 shadow-lg border border-primary/20">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg">
            <Image
              src={currentMember.imageSrc}
              alt={currentMember.name}
              fill
              className="object-cover"
              sizes="128px"
            />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">{currentMember.name}</h3>
            <p className="text-lg text-muted-foreground">{currentMember.title}</p>
            <Link
              href={currentMember.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-2"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-6 space-x-2">
        {members.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentMemberIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentMemberIndex
                ? "w-8 bg-primary"
                : "w-2 bg-muted"
            }`}
            aria-label={`View ${members[index].name}`}
          />
        ))}
      </div>
    </div>
  );
}

