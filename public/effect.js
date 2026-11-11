const heading = document.querySelector("h1");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (heading) {
  const title = heading.textContent.trim();
  const titleText = document.createElement("span");
  titleText.className = "title-text";
  heading.textContent = "";
  heading.append(titleText);

  if (reduceMotion) {
    titleText.textContent = title;
  } else {
    const characters = Array.from(title);
    let index = 0;

    const typeNextCharacter = () => {
      titleText.textContent += characters[index];
      index += 1;

      if (index < characters.length) {
        window.setTimeout(typeNextCharacter, 85);
      }
    };

    window.setTimeout(typeNextCharacter, 180);
  }
}

if (!reduceMotion) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let frameId = 0;

  const moveHighlight = () => {
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    document.body.style.setProperty("--cursor-x", `${currentX}px`);
    document.body.style.setProperty("--cursor-y", `${currentY}px`);
    document.body.style.setProperty("--cursor-highlight-opacity", "1");

    if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
      frameId = window.requestAnimationFrame(moveHighlight);
    } else {
      frameId = 0;
    }
  };

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    targetX = event.clientX;
    targetY = event.clientY;

    if (!frameId) {
      frameId = window.requestAnimationFrame(moveHighlight);
    }
  });

  document.documentElement.addEventListener("pointerleave", () => {
    document.body.style.setProperty("--cursor-highlight-opacity", "0");
  });
}
