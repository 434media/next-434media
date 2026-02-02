"use client"

import { FadeIn } from "../FadeIn"
import EventCarousel from "./EventCarousel"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SeminarSeriesProps {
  locale: Locale
  dict: Dictionary
}

export default function SeminarSeries({ locale, dict }: SeminarSeriesProps) {
  return (
    <FadeIn>
      <div className="space-y-16 sm:space-y-20 lg:space-y-24">
        {/* TITLE SECTION */}
        <div className="relative text-center">
          {/* Component Number */}
          <div className="relative inline-block mb-8">
            <div className="relative w-20 h-20 bg-[#8B1E3F] text-white flex items-center justify-center">
              <span className="text-3xl font-black">1</span>
              {/* Accent corner */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#FF6B35]" />
            </div>
          </div>

          {/* Title */}
          <div className="relative max-w-4xl mx-auto">
            <p className="text-[#FF6B35] font-medium text-sm uppercase tracking-wider mb-4">
              {locale === "es" ? "Aprendizaje como Catálisis para el Cambio" : "Learning as a Catalyst for Change"}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-neutral-900">
              {dict?.sdoh?.seminar?.title || "Seminar + Speaker Series"}
            </h2>
            {/* Accent underline */}
            <div className="mx-auto w-16 h-1 bg-[#A31545] mb-6" />
            <p className="text-lg sm:text-xl text-neutral-500 leading-relaxed max-w-2xl mx-auto">
              {locale === "es"
                ? "Descubre el primer componente de nuestro programa integral"
                : "Discover the first component of our comprehensive program"}
            </p>
          </div>
        </div>

        {/* CONTENT SECTION - Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-center">
          {/* Text Content Column */}
          <div className="order-2 md:order-1 space-y-8">
            {/* First paragraph */}
            <div className="relative pl-6">
              <div className="absolute left-0 top-0 w-1 h-full bg-[#A31545]" />
              <p className="text-lg leading-relaxed text-neutral-600">
                {locale === "es" ? (
                  <>
                    <span className="font-semibold text-neutral-900">{dict?.sdoh?.title || "¿Qué es SDOH?"}</span>{" "}
                    {dict?.sdoh?.seminar?.description1 ||
                      "es un programa diseñado para desglosar este tema grande y a menudo mal entendido en un lenguaje cotidiano, y mostrar cómo los líderes locales, innovadores y emprendedores pueden convertir la conciencia en acción."}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-neutral-900">¿Qué es SDOH?</span>{" "}
                    {dict?.sdoh?.seminar?.description1 ||
                      "is a program designed to break down this big, often misunderstood topic into everyday language—and show how local leaders, innovators, and entrepreneurs can turn awareness into action."}
                  </>
                )}
              </p>
            </div>

            {/* Second paragraph */}
            <div className="relative">
              <p className="text-lg leading-relaxed text-neutral-600">
                {locale === "es" ? (
                  <>
                    {dict?.sdoh?.seminar?.description2 ||
                      "Creemos que al comprender las causas fundamentales de los resultados de salud"}{" "}
                    <span className="italic font-medium text-[#A31545]">
                      {dict?.sdoh?.seminar?.causa || "la causa principal"}
                    </span>
                    {dict?.sdoh?.seminar?.description2End ||
                      "—podemos inspirar a más personas a construir el futuro de la salud aquí mismo en nuestras comunidades."}
                  </>
                ) : (
                  <>
                    {dict?.sdoh?.seminar?.description2 ||
                      "We believe that by understanding the root causes of health outcomes"}
                    —
                    <span className="italic font-medium text-[#A31545]">
                      {dict?.sdoh?.seminar?.causa || "la causa principal"}
                    </span>
                    {dict?.sdoh?.seminar?.description2End ||
                      "—we can inspire more people to build the future of health right here in our communities."}
                  </>
                )}
              </p>
            </div>

            {/* Highlighted content */}
            <div className="relative">
              <div className="relative p-8 border border-neutral-200 bg-neutral-50">
                {/* Accent line */}
                <div className="absolute left-0 top-0 w-1 h-full bg-[#FF6B35]" />
                <p className="text-lg leading-relaxed font-medium text-neutral-700 pl-4">
                  {dict?.sdoh?.seminar?.highlight ||
                    "The series features live events and panels designed to spark conversation, raise awareness, and make complex health topics feel approachable and relevant—especially for aspiring founders, healthcare workers, educators, and community changemakers."}
                </p>
              </div>
            </div>
          </div>

          {/* Video Column - EventCarousel */}
          <div className="order-1 md:order-2 relative">
            <EventCarousel />
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
