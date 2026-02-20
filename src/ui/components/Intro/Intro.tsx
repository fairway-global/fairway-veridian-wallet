import { IonIcon } from "@ionic/react";
import "@ionic/react/css/ionic-swiper.css";
import { pauseCircleOutline, playCircleOutline } from "ionicons/icons";
import Lottie from "lottie-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperClass } from "swiper/types";
import { i18n } from "../../../i18n";
import introImg0 from "../../assets/images/intro-0.png";
import introImg1 from "../../assets/images/intro-1.png";
import introImg2 from "../../assets/images/intro-2.png";
import introImg3 from "../../assets/images/intro-3.png";
import "./Intro.scss";
import { SlideItem } from "./Intro.types";

const items: SlideItem[] = [
  {
    title: `${i18n.t("onboarding.slides.0.title")}`,
    description: `${i18n.t("onboarding.slides.0.description")}`,
    image: introImg0,
  },
  {
    title: `${i18n.t("onboarding.slides.1.title")}`,
    description: `${i18n.t("onboarding.slides.1.description")}`,
    image: introImg1,
  },
  {
    title: `${i18n.t("onboarding.slides.2.title")}`,
    description: `${i18n.t("onboarding.slides.2.description")}`,
    image: introImg2,
  },
  {
    title: `${i18n.t("onboarding.slides.3.title")}`,
    description: `${i18n.t("onboarding.slides.3.description")}`,
    image: introImg3,
  },
];

const highlights = [
  {
    title: "Compliance-ready identity",
    description: "Built for regulated digital asset and institutional flows.",
  },
  {
    title: "Privacy by design",
    description: "Secure credentials with selective disclosure by default.",
  },
  {
    title: "Multi-chain confidence",
    description: "A clean wallet experience for modern crypto ecosystems.",
  },
];

const Intro = () => {
  const [swiper, setSwiper] = useState<SwiperClass | undefined>(undefined);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplayIsClicked, setAutoplayIsClicked] = useState(false);
  const [visibleHighlights, setVisibleHighlights] = useState<number[]>([]);
  const highlightContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const highlightElements =
      highlightContainerRef.current?.querySelectorAll<HTMLElement>(
        "[data-highlight-index]"
      );

    if (!highlightElements?.length) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisibleHighlights(highlights.map((_, index) => index));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const highlightIndex = Number(
            entry.target.getAttribute("data-highlight-index")
          );
          if (Number.isNaN(highlightIndex)) return;

          setVisibleHighlights((current) =>
            current.includes(highlightIndex)
              ? current
              : [...current, highlightIndex]
          );
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
      }
    );

    highlightElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  const handleAutoplay = () => {
    if (autoplay) {
      swiper?.autoplay?.stop();
      setAutoplay(false);
    } else {
      swiper?.autoplay?.start();
      setAutoplay(true);
    }

    setAutoplayIsClicked(true);
    setTimeout(() => setAutoplayIsClicked(false), 300);
  };

  return (
    <div className="slides-container">
      <div className="slides">
        <Swiper
          className="swiper-container"
          onSwiper={(swiper: SwiperClass) => setSwiper(swiper)}
          onSlideChange={() =>
            swiper ? setActiveIndex(swiper.realIndex) : null
          }
          slidesPerView={1}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
          }}
          loop={true}
          modules={[Autoplay]}
        >
          {items.map((slide, index) => (
            <SwiperSlide key={index}>
              {slide.lottie ? (
                <Lottie
                  className={activeIndex === index ? "text-fadein-down" : ""}
                  animationData={slide.lottie}
                  loop={false}
                />
              ) : (
                <img
                  src={slide.image}
                  alt={slide.title}
                  className={`image ${
                    activeIndex === index ? "text-fadein-down" : ""
                  }`}
                />
              )}
              {slide.title && (
                <h2 className={activeIndex === index ? "text-fadein" : ""}>
                  {slide.title}
                </h2>
              )}
              {slide.description && (
                <p className={activeIndex === index ? "text-fadein" : ""}>
                  {slide.description}
                </p>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      {items.length > 1 && (
        <div
          data-testid="slide-controls"
          className="pagination"
        >
          {items.map((_, index) => (
            <div
              key={index}
              className={
                activeIndex === index
                  ? "page-indicator-active"
                  : "page-indicator"
              }
            />
          ))}
          <div className="play-container">
            <IonIcon
              data-testid="play-indicator"
              className={`play-indicator ${autoplayIsClicked ? "clicked" : ""}`}
              icon={autoplay ? pauseCircleOutline : playCircleOutline}
              onClick={handleAutoplay}
            />
          </div>
        </div>
      )}
      <div
        className="onboarding-highlights"
        ref={highlightContainerRef}
      >
        {highlights.map((highlight, index) => {
          const cardStyle = {
            "--highlight-delay": `${index * 120}ms`,
          } as CSSProperties;

          return (
            <article
              key={highlight.title}
              data-highlight-index={index}
              className={`onboarding-highlight-card ${
                visibleHighlights.includes(index) ? "is-visible" : ""
              }`}
              style={cardStyle}
            >
              <span
                className="highlight-dot"
                aria-hidden="true"
              >
                <span />
              </span>
              <div className="highlight-copy">
                <h4>{highlight.title}</h4>
                <p>{highlight.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export { Intro };
