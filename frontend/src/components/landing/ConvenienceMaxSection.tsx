import React from "react"
import { Iphone15Pro } from "@/components/ui/iphone-15-pro"
import { WordRotate } from "@/components/ui/word-rotate"
import { Bell, Package, Tag } from "lucide-react"

export default function ConvenienceMaxSection() {
  const words = ["о доставках", "о снижении цен", "о новых байках"]

  return (
    <div id="convenience" className="relative w-full overflow-hidden bg-background">
      <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-14 pt-12 md:pt-16 pb-2 md:pb-3">
        {/* Огромный заголовок, который слегка перекрывает телефон и уходит в фейд снизу */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 z-0 flex justify-center">
          <h2
            className="select-none font-extrabold tracking-tight text-foreground text-center text-[16.5vw] md:text-[10.5rem] leading-[0.82]"
            style={{ opacity: 0.18, WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent)", maskImage: "linear-gradient(to bottom, black 85%, transparent)" }}
          >
            <span className="block">Удобство на</span>
            <span className="block">максимум</span>
          </h2>
        </div>

        {/* Центр — iPhone с экраном уведомлений и текстами внутри */}
        <div className="relative z-10 grid place-items-center mt-[6vw]">
          <div className="relative mx-auto">
            {/* декоративное свечение за телефоном */}
            <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
              <div className="h-[46vh] w-[46vh] rounded-full bg-gradient-to-b from-orange-500/10 via-amber-400/10 to-transparent blur-2xl" />
            </div>

            {/* Единая маска на стек телефона и экрана: общий фейд/блюр снизу */}
            <div
              className="relative"
              style={{ WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 62%)", maskImage: "linear-gradient(to bottom, black 50%, transparent 62%)" }}
            >
              <Iphone15Pro className="w-[62vw] max-w-[520px] md:max-w-[560px] h-auto drop-shadow-2xl" />

              {/* Экран: компактная версия внутри общей маски */}
              <div className="absolute left-1/2 top-[11%] w-[72%] -translate-x-1/2">
                <div className="rounded-[26px] p-5 md:p-6 shadow-2xl border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/80 to-white/60 dark:from-zinc-900/70 dark:to-zinc-900/60 backdrop-blur-xl">
                  {/* Верхний статус-пилл: мягкий и ненавязчивый */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 shadow-sm">
                      <Bell className="h-4 w-4" aria-hidden="true" />
                      <span className="font-medium">Push‑уведомления подключены</span>
                    </span>
                  </div>

                  {/* Заголовок с динамическим словом, без некрасивного переноса "о" */}
                  <div className="mt-4 text-center text-[1.3rem] md:text-[1.8rem] lg:text-[2.1rem] font-semibold leading-tight text-foreground">
                    Управляй и получай уведомления{' '}
                    <span className="whitespace-nowrap">о{' '}
                      <span className="inline-flex items-center align-middle">
                        <WordRotate words={words} duration={1800} className="text-base md:text-xl lg:text-2xl font-bold text-foreground" />
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 text-center text-3xl md:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                    прямо в телефоне!
                  </div>

                  {/* Мягкие демонстрационные уведомления */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10 shadow-sm">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="text-sm leading-tight">
                        <div className="font-medium text-foreground">Новая доставка</div>
                        <div className="text-muted-foreground">Прибытие завтра, 10:00</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10 shadow-sm">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Package className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="text-sm leading-tight">
                        <div className="font-medium text-foreground">Отгрузка оформлена</div>
                        <div className="text-muted-foreground">Трек‑номер отправлен в чат</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/65 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10 shadow-sm">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Tag className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="text-sm leading-tight">
                        <div className="font-medium text-foreground">Скидка −15%</div>
                        <div className="text-muted-foreground">На аксессуары к вашему байку</div>
                      </div>
                    </div>
                  </div>

                  {/* Чипы с категориями: мягкие, второстепенные */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs md:text-sm">
                    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10">
                      <Bell className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="font-medium">Уведомления</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10">
                      <Package className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="font-medium">Отгрузки</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-zinc-800/60 border border-white/40 dark:border-white/10">
                      <Tag className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="font-medium">Скидки</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Общая зона фейда/блюра у нижней границы блока */}
              <div className="pointer-events-none absolute inset-x-0 bottom-[-2vh] h-[20vh] bg-gradient-to-b from-background/0 via-background/70 to-background backdrop-blur-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}