import React from 'react';
import { Card } from "@/components/ui/card";

export function ReviewsSection() {
  const reviews = [
    {
      bike: "Specialized Turbo Kenevo SL",
      city: "Тамбов",
      id: 1,
      image: "/ext%20photos/TambovReview.jpg"
    },
    {
      bike: "Canyon Sender",
      city: "Москва",
      id: 2,
      image: "/ext%20photos/RodionMscReview.jpg"
    }
  ];

  return (
    <section className="w-full py-20 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-[32px] md:text-5xl lg:text-[56px] leading-[1.1] font-extrabold text-gray-900 mb-12 tracking-tight font-manrope text-center">
          💬 Реальные истории наших клиентов
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {reviews.map((review) => (
            <Card key={review.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow overflow-hidden">
              {/* Screenshot */}
              <div className="w-full relative rounded-lg overflow-hidden mb-3 bg-[#E5E7EB]">
                <img 
                  src={review.image} 
                  alt={`Отзыв клиента из г. ${review.city}`}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>
              
              {/* Caption */}
              <div className="text-sm text-[#6B7280] font-medium pt-3 border-t border-gray-50">
                {review.bike}, {review.city}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
