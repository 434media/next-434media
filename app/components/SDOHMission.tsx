"use client"

import { useRef } from "react"
import { motion, useInView } from "motion/react"
import Image from "next/image"
import { FadeIn } from "./FadeIn"

export function SDOHMission() {
  const missionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(missionRef, { once: true, amount: 0.2 })

  return (
    <section ref={missionRef} className="py-16 sm:py-24 bg-gradient-to-b from-neutral-50 to-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <FadeIn>
          {/* Partnership Banner */}
          <div className="relative mb-16 sm:mb-24 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 py-8 sm:py-12 px-6 sm:px-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-white max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                    Powered by VelocityTX & Methodist Healthcare Ministries
                  </h2>
                  <p className="text-white/90 text-base sm:text-lg">
                    In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health Accelerator
                    program connects education, entrepreneurship, and innovation through three core components.
                  </p>
                </div>

                {/* Decorative element */}
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm border border-white/30 animate-pulse"></div>
                  <div
                    className="absolute inset-4 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 animate-pulse"
                    style={{ animationDelay: "0.5s" }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-20 h-20 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 8V16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 12H16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Wave decoration */}
            <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
              <svg
                viewBox="0 0 1200 120"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 w-full h-24 text-white"
              >
                <path
                  d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
                  opacity=".25"
                  fill="currentColor"
                ></path>
                <path
                  d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
                  opacity=".5"
                  fill="currentColor"
                ></path>
                <path
                  d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
                  fill="currentColor"
                ></path>
              </svg>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-16 sm:mb-24">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600 mb-6">
                Seminar + Speaker Series
              </h2>

              <div className="space-y-6 text-neutral-700">
                <p className="text-lg sm:text-xl leading-relaxed">
                  <span className="font-bold text-cyan-600">¿Qué es SDOH?</span> is a program designed to break down
                  this big, often misunderstood topic into everyday language—and show how local leaders, innovators, and
                  entrepreneurs can turn awareness into action.
                </p>

                <p className="text-lg sm:text-xl leading-relaxed">
                  We believe that by understanding the root causes of health outcomes—
                  <span className="italic font-medium">la causa principal</span>—we can inspire more people to build the
                  future of health right here in our communities.
                </p>

                <div className="bg-gradient-to-r from-yellow-50 to-white p-6 rounded-xl border-l-4 border-yellow-400 shadow-sm">
                  <p className="text-lg leading-relaxed">
                    The series features live events and panels designed to spark conversation, raise awareness, and make
                    complex health topics feel approachable and relevant—especially for aspiring founders, healthcare
                    workers, educators, and community changemakers.
                  </p>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 relative">
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-100 rounded-full opacity-20 animate-pulse"></div>
              <div
                className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-100 rounded-full opacity-20 animate-pulse"
                style={{ animationDelay: "1s" }}
              ></div>

              {/* Main illustration */}
              <div className="relative z-10 bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100">
                <div className="aspect-square relative">
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/healthcare-panel-discussion.png"
                    alt="Healthcare professionals in a panel discussion"
                    fill
                    className="object-cover"
                  />

                  {/* Overlay with mission keywords */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-neutral-900/30 to-transparent flex flex-col justify-end p-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["Education", "Innovation", "Awareness", "Action", "Community"].map((keyword, index) => (
                        <motion.span
                          key={keyword}
                          initial={{ opacity: 0, y: 20 }}
                          animate={isInView ? { opacity: 1, y: 0 } : {}}
                          transition={{ delay: index * 0.1 + 0.5, duration: 0.5 }}
                          className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
                        >
                          {keyword}
                        </motion.span>
                      ))}
                    </div>

                    <motion.h3
                      initial={{ opacity: 0, y: 20 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="text-2xl font-bold text-white"
                    >
                      Building Healthier Communities Together
                    </motion.h3>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Three Core Components */}
          <div className="bg-gradient-to-r from-neutral-50 to-white rounded-2xl p-8 sm:p-12 shadow-md border border-neutral-100">
            <h3 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600 mb-8 text-center">
              Three Core Components
            </h3>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  title: "Education",
                  description:
                    "Breaking down complex health topics into accessible, actionable knowledge for everyone.",
                  icon: (
                    <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  ),
                },
                {
                  title: "Entrepreneurship",
                  description: "Empowering innovators to build solutions that address social determinants of health.",
                  icon: (
                    <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  ),
                },
                {
                  title: "Innovation",
                  description: "Creating platforms for collaboration between healthcare, technology, and community.",
                  icon: (
                    <svg className="w-8 h-8 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  ),
                },
              ].map((component, index) => (
                <motion.div
                  key={component.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="bg-cyan-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    {component.icon}
                  </div>
                  <h4 className="text-xl font-bold text-neutral-800 mb-3">{component.title}</h4>
                  <p className="text-neutral-600">{component.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
