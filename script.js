function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

let audioContext;
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioContext initialized successfully");
    } catch (e) {
      console.error("Error initializing AudioContext:", e);
    }
  }
}

function drawVisualizer(canvas, analyser) {
  const ctx = canvas.getContext("2d");
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = `rgb(${dataArray[i] + 100}, 50, 50)`;
      ctx.fillRect(
        i * barWidth,
        canvas.height - barHeight,
        barWidth - 1,
        barHeight
      );
    }

    canvas._animationFrame = requestAnimationFrame(draw);
  }

  draw();
}

const isiOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && "ontouchend" in document);

// Store all album configurations
const albumConfigs = {
  1: audioSources, // config_1.js
  2: audioSources2, // config_2.js
  3: audioSources3, // config_3.js
};

// Function to update audio sources for all tracks
function updateAudioSources(albumNumber) {
  const config = albumConfigs[albumNumber];
  if (!config) return;

  document.querySelectorAll("button[data-audio]").forEach((button) => {
    const audioId = button.getAttribute("data-audio");
    const audio = document.getElementById(audioId);
    const trackTitle = document.getElementById(
      `track-title-${audioId.replace("audio", "")}`
    );

    if (config[audioId]) {
      const source = audio.querySelector("source");
      source.src = config[audioId].url;
      trackTitle.textContent = config[audioId].title;
      audio.load();

      // Reset the audio state
      audio.pause();
      button.textContent = "▶️";
      const canvas = document.querySelector(
        `canvas[data-visualizer="${audioId}"]`
      );
      if (canvas) {
        cancelAnimationFrame(canvas._animationFrame);
      }
    }
  });
}

// Add event listener for album selection
document.getElementById("album-select").addEventListener("change", (e) => {
  const selectedAlbum = parseInt(e.target.value);
  updateAudioSources(selectedAlbum);
});

// Initialize with first album
updateAudioSources(1);

document.querySelectorAll("button[data-audio]").forEach((button) => {
  const audioId = button.getAttribute("data-audio");
  const audio = document.getElementById(audioId);
  const seekBar = document.querySelector(`input[data-seek="${audioId}"]`);
  const volumeSlider = document.querySelector(
    `input[data-volume="${audioId}"]`
  );
  const timeDisplay = button.parentElement.querySelector(".time-display");
  const canvas = document.querySelector(`canvas[data-visualizer="${audioId}"]`);
  const trackTitle = document.getElementById(
    `track-title-${audioId.replace("audio", "")}`
  );

  // Set the audio source and title from config
  if (audioSources[audioId]) {
    const source = audio.querySelector("source");
    source.src = audioSources[audioId].url;
    trackTitle.textContent = audioSources[audioId].title;
    audio.load(); // Reload the audio element with new source
  }

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  audio.addEventListener("loadedmetadata", () => {
    console.log("Audio metadata loaded:", {
      duration: audio.duration,
      readyState: audio.readyState,
      error: audio.error,
      src: audio.currentSrc,
    });
    timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
  });

  audio.addEventListener("error", (e) => {
    console.error("Audio error:", e);
    console.error("Audio error details:", audio.error);
    console.error("Audio source:", audio.currentSrc);
  });

  audio.addEventListener("canplay", () => {
    console.log("Audio can play now");
  });

  audio.addEventListener("stalled", () => {
    console.error("Audio stalled - buffering");
  });

  button.addEventListener("click", async () => {
    try {
      initAudioContext();

      document.querySelectorAll("audio").forEach((other) => {
        if (other !== audio) {
          other.pause();
          const otherBtn = document.querySelector(
            `button[data-audio="${other.id}"]`
          );
          if (otherBtn) otherBtn.textContent = "▶️";
          const otherCanvas = document.querySelector(
            `canvas[data-visualizer="${other.id}"]`
          );
          if (otherCanvas) cancelAnimationFrame(otherCanvas._animationFrame);
        }
      });

      if (!audio._visualizerInitialized) {
        try {
          const source = audioContext.createMediaElementSource(audio);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          drawVisualizer(canvas, analyser);
          audio._source = source;
          audio._analyser = analyser;
          audio._visualizerInitialized = true;
          console.log("Visualizer initialized successfully");
        } catch (e) {
          console.error("Error initializing visualizer:", e);
        }
      }

      if (audio.paused) {
        try {
          await audio.play();
          button.textContent = "⏸️";
          console.log("Audio playback started");
          if (audio._analyser) {
            drawVisualizer(canvas, audio._analyser);
          }
        } catch (e) {
          console.error("Error starting playback:", e);
          button.textContent = "❌";
        }
      } else {
        audio.pause();
        button.textContent = "▶️";
        cancelAnimationFrame(canvas._animationFrame);
      }
    } catch (err) {
      console.error(`Playback error for ${audioId}:`, err);
      button.textContent = "❌";
    }
  });

  // audio.addEventListener("timeupdate", () => {
  //   seekBar.value = audio.currentTime;
  //   seekBar.max = audio.duration;
  //   timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(
  //     audio.duration
  //   )}`;
  // });
  audio.addEventListener("timeupdate", () => {
    if (!isNaN(audio.duration)) {
      seekBar.value = audio.currentTime;
      seekBar.max = audio.duration;
      timeDisplay.textContent = `${formatTime(
        audio.currentTime
      )} / ${formatTime(audio.duration)}`;
    }
  });

  seekBar.addEventListener("input", () => {
    audio.currentTime = seekBar.value;
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(
      audio.duration
    )}`;
  });

  if (!isiOS) {
    volumeSlider.addEventListener("input", () => {
      audio.volume = volumeSlider.value;
    });
  } else {
    volumeSlider.style.display = "none";
    const notice = document.createElement("div");
    notice.className = "ios-volume-note";
    notice.textContent = "Use your device's volume buttons on iOS.";
    volumeSlider.parentElement.appendChild(notice);
  }

  audio.addEventListener("ended", () => {
    button.textContent = "▶️";
    cancelAnimationFrame(canvas._animationFrame);

    // Auto-play next track if available
    const currentIndex = parseInt(audioId.replace("audio", ""));
    const nextId = `audio${currentIndex + 1}`;
    const nextAudio = document.getElementById(nextId);
    const nextButton = document.querySelector(`button[data-audio="${nextId}"]`);

    if (nextAudio && nextButton) {
      console.log(`Auto-playing next track: ${nextId}`);

      // Small delay ensures DOM and audio are ready
      setTimeout(() => {
        nextButton.click();
      }, 300);
    }
  });
});
