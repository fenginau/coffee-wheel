(function () {
  var DEFAULT_COLORS = ["#7f5539", "#d9a441", "#4b7baf", "#4f8a5b", "#7a4869", "#5e6b2f"];
  var DOT_COUNT = 50;
  var EMPLOYEE_NAMES = [
    "Steve W",
    "Dan",
    "Jay",
    "Steve N",
    "Feng",
    "Moin",
    "Ash",
    "Josh",
    "Mak",
    "Henry"
  ];
  var DEFAULT_TASK_OPTIONS = [
    "Refill the coffee and pretend it is infrastructure work",
    "Translate one vague message into one useful ticket",
    "Close five tabs and still keep the important chaos",
    "Write a status update that sounds calmer than reality",
    "Find the blocker hiding inside 'quick question'",
    "Survive a meeting that could have been two bullet points"
  ];

  function getRandomOtherEmployee(employeeName) {
    var candidates = [];
    var i;

    for (i = 0; i < EMPLOYEE_NAMES.length; i += 1) {
      if (EMPLOYEE_NAMES[i] !== employeeName) {
        candidates.push(EMPLOYEE_NAMES[i]);
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function buildTaskSpec(employeeName) {
    var randomCoworker = getRandomOtherEmployee(employeeName);

    switch (employeeName) {
      case "Steve W":
        return {
          options: [
            "Ask everyone to go back to work",
            "Start a stand-up",
            "Assign " + randomCoworker + " a task",
            "Try again"
          ],
          forceIndex: 3,
          refreshOnSpin: true
        };
      case "Dan":
        return {
          options: [
            "Hot cross bun",
            "Meat pie",
            "Air-fry something new",
            "Air-fry " + randomCoworker
          ],
          refreshOnSpin: true
        };
      case "Jay":
        return {
          options: [
            "Board game",
            "Coding",
            "Shoot " + randomCoworker + " (Nerf bullets only)",
            "Sing a song"
          ],
          bypassIndexes: [0],
          refreshOnSpin: true
        };
      case "Ash":
        return {
          options: ["Coffee", "Coffee", "Coffee", "Coffee"]
        };
      case "Josh":
        return {
          options: [
            "Juggle 1 ball",
            "Juggle 2 balls",
            "Juggle 3 balls",
            "Juggle 4 balls with the Poke Ball"
          ]
        };
      case "Mak":
        return {
          options: ["Attack on Titan"],
          infiniteSpin: true
        };
      case "Steve N":
        return {
          options: [
            "Reject the last change request",
            "Accept the next change request"
          ],
          randomOnly: true
        };
      case "Moin":
        return {
          options: [
            "Double-shot coffee",
            "Ask Mak about Attack on Titan",
            "Help Steve N reject the last request"
          ],
          bypassIndexes: [1]
        };
      case "Henry":
        return {
          options: [
            "Take Jay's work today",
            "Take Steve N's work today",
            "Do your work"
          ],
          forceIndex: 2
        };
      case "Feng":
        return {
          options: ["Ice cream", "Ice cream", "Ice cream", "Ice cream"],
          meltOnSpin: true
        };
      default:
        return {
          options: DEFAULT_TASK_OPTIONS.slice(0)
        };
    }
  }

  function normalizeAngle(angle) {
    angle = angle % 360;
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  }

  function getCurrentTime() {
    return new Date().getTime();
  }

  function getAngleDelta(currentAngle, previousAngle) {
    var delta = currentAngle - previousAngle;
    while (delta > 180) {
      delta -= 360;
    }
    while (delta < -180) {
      delta += 360;
    }
    return delta;
  }

  function getDirectionalRotationDelta(fromRotation, toRotation, spinDirection) {
    var normalizedFrom = normalizeAngle(fromRotation);
    var normalizedTo = normalizeAngle(toRotation);

    if (spinDirection < 0) {
      return -1 * normalizeAngle(normalizedFrom - normalizedTo);
    }

    return normalizeAngle(normalizedTo - normalizedFrom);
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = "";
    var i;
    var testLine;
    var startY;

    for (i = 0; i < words.length; i += 1) {
      testLine = currentLine ? currentLine + " " + words[i] : words[i];
      if (context.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (i = 0; i < lines.length; i += 1) {
      context.fillText(lines[i], x, startY + i * lineHeight);
    }
  }

  function createWheelController(config) {
    var canvas = config.canvas;
    var drawButton = config.drawButton;
    var result = config.result;
    var context = canvas.getContext("2d");
    var colors = config.colors || DEFAULT_COLORS;
    var dotCount = config.dotCount || DOT_COUNT;
    var options = [];
    var sectorLayout = [];
    var segmentSize = 0;
    var currentRotation = 0;
    var isSpinning = false;
    var controlsLocked = false;
    var selectedIndex = null;
    var isDragging = false;
    var dragMoved = false;
    var dragResultIndex = null;
    var spinCompletionTimer = null;
    var infiniteSpinTimer = null;
    var displayTextMapper = null;
    var dragStartAngle = 0;
    var dragStartRotation = 0;
    var lastPointerAngle = 0;
    var velocitySamples = [];
    var tickTimer = null;
    var lastTickAngle = null;
    var animationFrame =
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      function (callback) {
        return window.setTimeout(function () {
          callback(new Date().getTime());
        }, 16);
      };
    var cancelAnimationFrameCompat =
      window.cancelAnimationFrame ||
      window.webkitCancelAnimationFrame ||
      window.clearTimeout;

    function getPointFromEvent(event) {
      var point = event;
      if (event.touches && event.touches.length) {
        point = event.touches[0];
      } else if (event.changedTouches && event.changedTouches.length) {
        point = event.changedTouches[0];
      }
      return point;
    }

    function getPointerAngle(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI + 90;
    }

    function setWheelTransition(enabled, durationMs, easing) {
      var durationSeconds;
      var transitionCurve;

      if (enabled) {
        durationSeconds = (durationMs || 4800) / 1000;
        transitionCurve = easing || "cubic-bezier(0.17, 0.67, 0.2, 1)";
        canvas.style.webkitTransition = "-webkit-transform " + durationSeconds + "s " + transitionCurve;
        canvas.style.transition = "transform " + durationSeconds + "s " + transitionCurve;
      } else {
        canvas.style.webkitTransition = "none";
        canvas.style.transition = "none";
      }
    }

    function setWheelRotation(angle) {
      canvas.style.webkitTransform = "rotate(" + angle + "deg)";
      canvas.style.transform = "rotate(" + angle + "deg)";
    }

    function getRenderedWheelRotation() {
      var computedStyle;
      var transformValue;
      var values;
      var a;
      var b;

      if (window.getComputedStyle) {
        computedStyle = window.getComputedStyle(canvas, null);
        transformValue =
          computedStyle.transform ||
          computedStyle.webkitTransform ||
          computedStyle.mozTransform ||
          computedStyle.msTransform;
      } else {
        transformValue = canvas.style.transform || canvas.style.webkitTransform;
      }

      if (!transformValue || transformValue === "none") {
        return currentRotation;
      }

      if (transformValue.indexOf("matrix(") === 0) {
        values = transformValue.substring(7, transformValue.length - 1).split(",");
        a = parseFloat(values[0]);
        b = parseFloat(values[1]);
        return Math.atan2(b, a) * 180 / Math.PI;
      }

      if (transformValue.indexOf("rotate(") === 0) {
        return parseFloat(transformValue.substring(7, transformValue.length - 4)) || currentRotation;
      }

      return currentRotation;
    }

    function getWrappedIndex(index) {
      if (!options.length) {
        return 0;
      }
      while (index < 0) {
        index += options.length;
      }
      return index % options.length;
    }

    function getDisplayText(optionText, optionIndex) {
      if (typeof displayTextMapper === "function") {
        return displayTextMapper(optionText, optionIndex, options);
      }
      return optionText;
    }

    function getSectorSizeAt(index) {
      if (!options.length) {
        return 0;
      }
      if (config.getSectorSizeAt) {
        return config.getSectorSizeAt(index, options);
      }
      return 360 / options.length;
    }

    function rebuildSectorLayout() {
      var cursor;
      var i;
      var size;
      var start;
      var end;

      sectorLayout = [];
      if (!options.length) {
        segmentSize = 0;
        return;
      }

      segmentSize = getSectorSizeAt(0);
      cursor = -segmentSize / 2;

      for (i = 0; i < options.length; i += 1) {
        size = getSectorSizeAt(i);
        start = cursor;
        end = start + size;

        sectorLayout.push({
          start: normalizeAngle(start),
          end: normalizeAngle(end),
          center: normalizeAngle(start + size / 2),
          size: size
        });

        cursor = end;
      }
    }

    function angleIsWithinSector(angle, sector) {
      angle = normalizeAngle(angle);

      if (sector.start <= sector.end) {
        return angle >= sector.start && angle < sector.end;
      }

      return angle >= sector.start || angle < sector.end;
    }

    function getSectorIndexFromAngle(angle) {
      var normalizedAngle = normalizeAngle(angle);
      var i;

      for (i = 0; i < sectorLayout.length; i += 1) {
        if (angleIsWithinSector(normalizedAngle, sectorLayout[i])) {
          return i;
        }
      }

      return 0;
    }

    function getPointerDotAngle(rotationAngle) {
      return normalizeAngle(360 - normalizeAngle(rotationAngle));
    }

    function playTickSound() {
      if (typeof config.playTickSound === "function") {
        config.playTickSound();
      }
    }

    function stopTicking() {
      if (tickTimer !== null) {
        cancelAnimationFrameCompat(tickTimer);
        tickTimer = null;
      }
      lastTickAngle = null;
    }

    function watchTicks() {
      var dotSize = 360 / dotCount;
      var pointerAngle = getPointerDotAngle(getRenderedWheelRotation());
      var delta;
      var crossedCount;
      var i;

      if (lastTickAngle === null) {
        lastTickAngle = pointerAngle;
      } else {
        delta = getAngleDelta(pointerAngle, lastTickAngle);
        crossedCount = Math.floor(Math.abs(delta) / dotSize);

        if (crossedCount > 0) {
          if (crossedCount > 6) {
            crossedCount = 6;
          }
          for (i = 0; i < crossedCount; i += 1) {
            playTickSound();
          }
          lastTickAngle = pointerAngle;
        }
      }

      if (!isSpinning) {
        stopTicking();
        return;
      }

      tickTimer = animationFrame(watchTicks);
    }

    function startTicking() {
      stopTicking();
      lastTickAngle = getPointerDotAngle(getRenderedWheelRotation());
      tickTimer = animationFrame(watchTicks);
    }

    function buildSpinTarget(requestedIndex, spinDirection, allowBypass) {
      var resolvedIndex = requestedIndex;
      var sector = sectorLayout[requestedIndex];
      var minAngle;
      var maxAngle;
      var targetAngle;
      var bypassMinOffset = 1;
      var bypassMaxOffset = 5;
      var landedIndex;
      var bypassBoundaryAngle;
      var padding;

      if (
        allowBypass &&
        typeof config.isBypassOption === "function" &&
        config.isBypassOption(options[requestedIndex], requestedIndex, options)
      ) {
        if (spinDirection < 0) {
          bypassBoundaryAngle = sector.end;
          targetAngle = normalizeAngle(
            bypassBoundaryAngle + bypassMinOffset + Math.random() * (bypassMaxOffset - bypassMinOffset)
          );
        } else {
          bypassBoundaryAngle = sector.start;
          targetAngle = normalizeAngle(
            bypassBoundaryAngle - bypassMinOffset - Math.random() * (bypassMaxOffset - bypassMinOffset)
          );
        }
        landedIndex = getSectorIndexFromAngle(targetAngle);
        resolvedIndex = landedIndex;
      } else {
        padding = Math.min(10, Math.max(2, sector.size / 4));
        minAngle = sector.start + padding;
        maxAngle = sector.start + sector.size - padding;
        if (maxAngle <= minAngle) {
          targetAngle = sector.center;
        } else {
          targetAngle = minAngle + Math.random() * (maxAngle - minAngle);
        }
        resolvedIndex = requestedIndex;
      }

      return {
        targetAngle: targetAngle,
        resultIndex: resolvedIndex
      };
    }

    function drawSectorLabel(text, sector, textX, textY, textRadius, center, size, radius) {
      var drawConfig = config.getLabelLayout ? config.getLabelLayout(text, sector, size, options) : null;
      var rotation;
      var adjustedRadius;
      var adjustedX;
      var adjustedY;

      context.save();
      context.fillStyle = config.textColor || "#fffdf8";
      context.textAlign = "center";
      context.textBaseline = "middle";

      if (!drawConfig || !drawConfig.rotateLabel) {
        context.font = drawConfig && drawConfig.font ?
          drawConfig.font :
          (size <= 300 ? "bold 15px Arial" : "bold 17px Arial");
        wrapText(
          context,
          text,
          textX,
          textY,
          drawConfig && drawConfig.maxWidth ? drawConfig.maxWidth : (size <= 300 ? 86 : 100),
          drawConfig && drawConfig.lineHeight ? drawConfig.lineHeight : (size <= 300 ? 17 : 19)
        );
        context.restore();
        return;
      }

      rotation = sector.center - 90;
      adjustedRadius = textRadius + (drawConfig.radiusOffset || 0);
      adjustedX = center + Math.cos(sector.center * Math.PI / 180 - Math.PI / 2) * adjustedRadius;
      adjustedY = center + Math.sin(sector.center * Math.PI / 180 - Math.PI / 2) * adjustedRadius;

      context.translate(adjustedX, adjustedY);
      context.rotate(rotation * Math.PI / 180);
      context.textAlign = drawConfig.textAlign || "left";
      context.font = drawConfig.font || (size <= 300 ? "bold 12px Arial" : "bold 13px Arial");
      context.fillText(text, 0, 0);
      context.restore();
    }

    function drawWheel() {
      var size = canvas.width;
      var center = size / 2;
      var radius = center - 10;
      var textRadius = radius * 0.58;
      var i;
      var sector;
      var startAngle;
      var endAngle;
      var centerAngle;
      var textX;
      var textY;
      var dotAngle;
      var dotRadius;
      var dotX;
      var dotY;

      context.clearRect(0, 0, size, size);

      for (i = 0; i < options.length; i += 1) {
        sector = sectorLayout[i];
        startAngle = (sector.start - 90) * Math.PI / 180;
        endAngle = (sector.start + sector.size - 90) * Math.PI / 180;
        centerAngle = (sector.center - 90) * Math.PI / 180;
        textX = center + Math.cos(centerAngle) * textRadius;
        textY = center + Math.sin(centerAngle) * textRadius;

        context.beginPath();
        context.moveTo(center, center);
        context.arc(center, center, radius, startAngle, endAngle, false);
        context.closePath();
        context.fillStyle = colors[i % colors.length];
        context.fill();

        drawSectorLabel(getDisplayText(options[i], i), sector, textX, textY, textRadius, center, size, radius);
      }

      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2, false);
      context.lineWidth = 10;
      context.strokeStyle = "#ffffff";
      context.stroke();

      for (i = 0; i < dotCount; i += 1) {
        dotAngle = (-90 + (i * 360 / dotCount)) * Math.PI / 180;
        dotRadius = radius - 2;
        dotX = center + Math.cos(dotAngle) * dotRadius;
        dotY = center + Math.sin(dotAngle) * dotRadius;

        context.beginPath();
        context.arc(dotX, dotY, size <= 300 ? 3 : 4, 0, Math.PI * 2, false);
        context.fillStyle = "#f6f0e8";
        context.fill();
      }

      context.beginPath();
      context.arc(center, center, 28, 0, Math.PI * 2, false);
      context.fillStyle = "#ecd2a1";
      context.fill();
      context.lineWidth = 5;
      context.strokeStyle = "#ffffff";
      context.stroke();
    }

    function getSectorIndexFromPoint(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      var dx = clientX - centerX;
      var dy = clientY - centerY;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var radius = rect.width / 2;
      var clickAngle;
      var wheelAngle;

      if (distance > radius) {
        return null;
      }

      clickAngle = normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI + 90);
      wheelAngle = normalizeAngle(clickAngle - normalizeAngle(currentRotation));

      return getSectorIndexFromAngle(wheelAngle);
    }

    function setDisabledState(disabled) {
      drawButton.disabled = disabled;
      canvas.style.pointerEvents = disabled || controlsLocked ? "none" : "auto";
      if (typeof config.setControlsDisabled === "function") {
        config.setControlsDisabled(disabled);
      }
    }

    function clearSpinCompletionTimer() {
      if (spinCompletionTimer !== null) {
        window.clearTimeout(spinCompletionTimer);
        spinCompletionTimer = null;
      }
    }

    function stopInfiniteSpin(silent) {
      if (infiniteSpinTimer !== null) {
        cancelAnimationFrameCompat(infiniteSpinTimer);
        infiniteSpinTimer = null;
      }

      clearSpinCompletionTimer();
      stopTicking();

      if (isSpinning) {
        isSpinning = false;
        setDisabledState(false);
      }

      if (!silent) {
        result.innerHTML = "";
      }
    }

    function startInfiniteSpin(spinDirection) {
      function animate() {
        if (!isSpinning) {
          infiniteSpinTimer = null;
          return;
        }

        currentRotation += (spinDirection || 1) * 5;
        setWheelRotation(currentRotation);
        infiniteSpinTimer = animationFrame(animate);
      }

      stopInfiniteSpin(true);
      setWheelTransition(false);
      isSpinning = true;
      setDisabledState(true);
      result.innerHTML = "";
      startTicking();
      animate();
    }

    function finishSpin(finalIndex, doneCallback) {
      clearSpinCompletionTimer();
      currentRotation = normalizeAngle(currentRotation);
      result.innerHTML = "Result: " + options[finalIndex];
      setDisabledState(false);
      isSpinning = false;
      stopTicking();
      if (typeof config.onSpinEnd === "function") {
        config.onSpinEnd(options[finalIndex], finalIndex, controller);
      }
      if (typeof config.onResult === "function") {
        config.onResult(options[finalIndex], finalIndex, controller);
      }
      if (doneCallback) {
        doneCallback();
      }
    }

    function spinToSector(resultIndex, turnCount, spinDirection, allowBypass, doneCallback) {
      var spinTarget;
      var targetRotation;
      var normalizedRotation;
      var rotationDelta;

      if (typeof config.onSpinStart === "function") {
        config.onSpinStart(options[resultIndex], resultIndex, controller);
      }

      setWheelTransition(true);
      isSpinning = true;
      setDisabledState(true);
      result.innerHTML = "";
      startTicking();

      spinTarget = buildSpinTarget(resultIndex, spinDirection, allowBypass);
      targetRotation = normalizeAngle(360 - spinTarget.targetAngle);
      normalizedRotation = normalizeAngle(currentRotation);
      if (spinDirection < 0) {
        rotationDelta = -1 * (turnCount * 360 + normalizeAngle(normalizedRotation - targetRotation));
      } else {
        rotationDelta = turnCount * 360 + normalizeAngle(targetRotation - normalizedRotation);
      }

      currentRotation += rotationDelta;
      setWheelRotation(currentRotation);

      clearSpinCompletionTimer();
      spinCompletionTimer = window.setTimeout(function () {
        finishSpin(spinTarget.resultIndex, doneCallback);
      }, 4800);
    }

    function spinSelectedOrRandom(turnCount, spinDirection, allowBypass) {
      var resultIndex;
      var usedSelectedIndex;
      var spinPlan;
      var availableIndexes = [];
      var i;

      if (isSpinning || !options.length) {
        return;
      }

      if (typeof config.beforeSpinResolve === "function") {
        config.beforeSpinResolve(controller, "button");
      }

      if (selectedIndex === null) {
        for (i = 0; i < options.length; i += 1) {
          if (
            typeof config.isBypassOption !== "function" ||
            !config.isBypassOption(options[i], i, options)
          ) {
            availableIndexes.push(i);
          }
        }
        if (!availableIndexes.length) {
          for (i = 0; i < options.length; i += 1) {
            availableIndexes.push(i);
          }
        }
        resultIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      } else {
        resultIndex = selectedIndex;
      }

      usedSelectedIndex = selectedIndex !== null;
      selectedIndex = null;

      spinPlan = {
        requestedIndex: resultIndex,
        turnCount: turnCount || 5,
        spinDirection: spinDirection || 1,
        allowBypass: allowBypass !== false,
        source: "button",
        usedSelectedIndex: usedSelectedIndex
      };

      if (typeof config.resolveSpinPlan === "function") {
        spinPlan = config.resolveSpinPlan(spinPlan, controller) || spinPlan;
      }

      if (spinPlan.mode === "infinite") {
        if (typeof config.onSpinStart === "function") {
          config.onSpinStart(options[spinPlan.requestedIndex || 0], spinPlan.requestedIndex || 0, controller);
        }
        startInfiniteSpin(spinPlan.spinDirection || 1);
        return;
      }

      spinToSector(
        spinPlan.requestedIndex,
        spinPlan.turnCount,
        spinPlan.spinDirection,
        spinPlan.allowBypass,
        null
      );
    }

    function beginDrag(event) {
      var point;

      if (isSpinning) {
        return;
      }

      if (controlsLocked) {
        return;
      }

      point = getPointFromEvent(event);
      dragResultIndex = getSectorIndexFromPoint(point.clientX, point.clientY);
      if (dragResultIndex === null) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      }

      if (typeof config.beforeInteraction === "function") {
        config.beforeInteraction();
      }

      isDragging = true;
      dragMoved = false;
      velocitySamples = [];
      dragStartAngle = getPointerAngle(point.clientX, point.clientY);
      dragStartRotation = currentRotation;
      lastPointerAngle = dragStartAngle;
      setWheelTransition(false);
    }

    function moveDrag(event) {
      var point;
      var pointerAngle;
      var angleDelta;
      var now;

      if (!isDragging) {
        return;
      }

      point = getPointFromEvent(event);
      pointerAngle = getPointerAngle(point.clientX, point.clientY);
      angleDelta = getAngleDelta(pointerAngle, dragStartAngle);
      currentRotation = dragStartRotation + angleDelta;
      setWheelRotation(currentRotation);

      now = getCurrentTime();
      velocitySamples.push({
        time: now,
        angle: pointerAngle
      });

      while (velocitySamples.length > 6) {
        velocitySamples.shift();
      }

      if (Math.abs(getAngleDelta(pointerAngle, lastPointerAngle)) > 1) {
        dragMoved = true;
      }

      lastPointerAngle = pointerAngle;

      if (event.preventDefault) {
        event.preventDefault();
      }
    }

    function endDrag(event) {
      var point;
      var index;
      var velocity = 0;
      var firstSample;
      var lastSample;
      var deltaAngle;
      var deltaTime;
      var spinDirection;
      var spinPlan;

      if (!isDragging) {
        return;
      }

      isDragging = false;
      point = getPointFromEvent(event);

      if (!dragMoved) {
        index = getSectorIndexFromPoint(point.clientX, point.clientY);
        if (index !== null) {
          selectedIndex = index;
          result.innerHTML = "";
        }
        dragResultIndex = null;
        return;
      }

      if (velocitySamples.length >= 2) {
        firstSample = velocitySamples[0];
        lastSample = velocitySamples[velocitySamples.length - 1];
        deltaAngle = getAngleDelta(lastSample.angle, firstSample.angle);
        deltaTime = lastSample.time - firstSample.time;

        if (deltaTime > 0) {
          velocity = deltaAngle / (deltaTime / 16);
        }
      }

      spinDirection = velocity < 0 ? -1 : 1;
      velocity = Math.abs(velocity);

      if (velocity < 0.6) {
        velocity = 0.6;
      }

      if (typeof config.beforeSpinResolve === "function") {
        config.beforeSpinResolve(controller, "drag");
      }

      spinPlan = {
        requestedIndex: dragResultIndex,
        turnCount: 1 + Math.floor(Math.abs(velocity) / 12),
        spinDirection: spinDirection,
        allowBypass: true,
        source: "drag",
        usedSelectedIndex: false
      };

      if (typeof config.resolveSpinPlan === "function") {
        spinPlan = config.resolveSpinPlan(spinPlan, controller) || spinPlan;
      }

      if (spinPlan.mode === "infinite") {
        dragResultIndex = null;
        if (typeof config.onSpinStart === "function") {
          config.onSpinStart(options[spinPlan.requestedIndex || 0], spinPlan.requestedIndex || 0, controller);
        }
        startInfiniteSpin(spinPlan.spinDirection || 1);
      } else {
        spinToSector(
          spinPlan.requestedIndex,
          spinPlan.turnCount,
          spinPlan.spinDirection,
          spinPlan.allowBypass,
          function () {
            dragResultIndex = null;
          }
        );
      }

      if (event.preventDefault) {
        event.preventDefault();
      }
    }

    function resize() {
      var size = config.getCanvasSize ? config.getCanvasSize() : (window.innerWidth <= 420 ? 300 : 340);
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      drawWheel();
    }

    var controller = {
      setOptions: function (newOptions) {
        stopInfiniteSpin(true);
        displayTextMapper = null;
        options = newOptions.slice(0);
        rebuildSectorLayout();
        selectedIndex = null;
        dragResultIndex = null;
        result.innerHTML = "";
        drawWheel();
      },
      spinToSector: spinToSector,
      spinSelectedOrRandom: spinSelectedOrRandom,
      resize: resize,
      setResultText: function (text) {
        result.innerHTML = text;
      },
      getOptions: function () {
        return options.slice(0);
      },
      getIndexByLabel: function (label) {
        return options.indexOf(label);
      },
      setSelectedIndex: function (index) {
        selectedIndex = index;
      },
      resetSelection: function () {
        selectedIndex = null;
      },
      resetPosition: function () {
        stopInfiniteSpin(true);
        clearSpinCompletionTimer();
        currentRotation = 0;
        setWheelTransition(false);
        setWheelRotation(0);
        result.innerHTML = "";
        setDisabledState(false);
        isSpinning = false;
        stopTicking();
      },
      setDisplayTextMapper: function (mapper) {
        displayTextMapper = mapper || null;
        drawWheel();
      },
      setControlsLocked: function (locked) {
        controlsLocked = !!locked;
        drawButton.disabled = controlsLocked || isSpinning;
        canvas.style.pointerEvents = controlsLocked || isSpinning ? "none" : "auto";
      },
      stopInfiniteSpin: stopInfiniteSpin,
      redraw: drawWheel
      
    };

    drawButton.onclick = function () {
      if (typeof config.onButtonClick === "function") {
        config.onButtonClick(controller);
        return;
      }
      spinSelectedOrRandom(5, 1, true);
    };

    if (canvas.addEventListener) {
      canvas.addEventListener("mousedown", beginDrag, false);
      canvas.addEventListener("touchstart", beginDrag, false);
      document.addEventListener("mousemove", moveDrag, false);
      document.addEventListener("touchmove", moveDrag, false);
      document.addEventListener("mouseup", endDrag, false);
      document.addEventListener("touchend", endDrag, false);
      document.addEventListener("touchcancel", endDrag, false);
    } else {
      canvas.onmousedown = beginDrag;
      document.onmousemove = moveDrag;
      document.onmouseup = endDrag;
    }

    if (drawButton.addEventListener && typeof config.beforeInteraction === "function") {
      drawButton.addEventListener("mousedown", config.beforeInteraction, false);
      drawButton.addEventListener("touchstart", config.beforeInteraction, false);
    } else if (typeof config.beforeInteraction === "function") {
      drawButton.onmousedown = config.beforeInteraction;
    }

    setWheelTransition(true);
    setWheelRotation(0);
    resize();

    if (window.addEventListener) {
      window.addEventListener("resize", resize, false);
    } else if (window.attachEvent) {
      window.attachEvent("onresize", resize);
    }

    return controller;
  }

  function initCoffeeWheelPage() {
    var canvas = document.getElementById("wheel");
    var drawButton = document.getElementById("drawButton");
    var result = document.getElementById("result");
    var optionAot = document.getElementById("optionAot");
    var optionWork = document.getElementById("optionWork");
    var attackThemeAudio = document.getElementById("attackThemeAudio");
    var SPECIAL_AOT = "Attack on Titan";
    var SPECIAL_WORK = "Back to work";
    var controller;
    var audioContext = null;
    var audioUnlocked = false;
    var noiseBuffer = null;
    var aotToggleCount = 0;
    var workToggleCount = 0;
    var pendingAttackOnTitan = false;
    var pendingBackToWorkFakeout = false;

    if (!canvas || !drawButton || !result) {
      return;
    }

    function ensureAudioContext() {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }

      if (!audioContext) {
        try {
          audioContext = new AudioContextClass();
        } catch (error) {
          audioContext = null;
        }
      }

      return audioContext;
    }

    function ensureNoiseBuffer() {
      var contextInstance = ensureAudioContext();
      var bufferSize;
      var buffer;
      var data;
      var i;

      if (!contextInstance) {
        return null;
      }

      if (noiseBuffer) {
        return noiseBuffer;
      }

      try {
        bufferSize = Math.max(1, Math.floor(contextInstance.sampleRate * 0.03));
        buffer = contextInstance.createBuffer(1, bufferSize, contextInstance.sampleRate);
        data = buffer.getChannelData(0);
        for (i = 0; i < bufferSize; i += 1) {
          data[i] = Math.random() * 2 - 1;
        }
        noiseBuffer = buffer;
      } catch (error) {
        noiseBuffer = null;
      }

      return noiseBuffer;
    }

    function unlockAudio() {
      var contextInstance = ensureAudioContext();

      if (!contextInstance || audioUnlocked) {
        return;
      }

      if (contextInstance.resume) {
        contextInstance.resume();
      }

      audioUnlocked = true;
    }

    function playAttackThemeCue() {
      if (!attackThemeAudio) {
        return;
      }

      stopAttackTheme();

      try {
        attackThemeAudio.currentTime = 0;
        attackThemeAudio.play();
      } catch (error) {
        return;
      }

      try {
        attackThemeAudio._stopTimer = window.setTimeout(function () {
          stopAttackTheme();
        }, 5000);
      } catch (error2) {
        return;
      }
    }

    function stopAttackTheme() {
      if (!attackThemeAudio) {
        return;
      }

      if (attackThemeAudio._stopTimer) {
        window.clearTimeout(attackThemeAudio._stopTimer);
        attackThemeAudio._stopTimer = null;
      }

      try {
        attackThemeAudio.pause();
        attackThemeAudio.currentTime = 0;
      } catch (error) {
        return;
      }
    }

    function playTickSound() {
      var contextInstance = ensureAudioContext();
      var buffer;
      var source;
      var filter;
      var gain;
      var now;

      if (!contextInstance || !audioUnlocked) {
        return;
      }

      if (contextInstance.state === "suspended" && contextInstance.resume) {
        contextInstance.resume();
      }

      try {
        buffer = ensureNoiseBuffer();
        if (!buffer) {
          return;
        }

        source = contextInstance.createBufferSource();
        source.buffer = buffer;
        filter = contextInstance.createBiquadFilter();
        gain = contextInstance.createGain();
        now = contextInstance.currentTime;

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1700, now);
        filter.Q.setValueAtTime(1.4, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(contextInstance.destination);
        source.start(now);
        source.stop(now + 0.03);
      } catch (error) {
        return;
      }
    }

    function getSectorSizeAt(index, optionList) {
      var workIndex;
      var remainingOptions;

      workIndex = optionList.indexOf(SPECIAL_WORK);
      if (workIndex >= 0) {
        if (index === workIndex) {
          return 270;
        }
        remainingOptions = optionList.length - 1;
        return remainingOptions > 0 ? 90 / remainingOptions : 90;
      }

      return 360 / optionList.length;
    }

    function radiusOffsetForNarrowLabel(size, text) {
      if (text === SPECIAL_AOT) {
        return size <= 300 ? -16 : -12;
      }
      if (text === "Ice Cream") {
        return size <= 300 ? -20 : -18;
      }
      return size <= 300 ? -18 : -14;
    }

    function getLabelLayout(text, sector, size, optionList) {
      var isWorkLayout = optionList.indexOf(SPECIAL_WORK) >= 0;
      var isNarrowSector = isWorkLayout && text !== SPECIAL_WORK;

      if (!isNarrowSector) {
        return {
          rotateLabel: false,
          font: size <= 300 ? "bold 16px Arial" : "bold 18px Arial",
          maxWidth: size <= 300 ? 76 : 88,
          lineHeight: size <= 300 ? 18 : 20
        };
      }

      return {
        rotateLabel: true,
        radiusOffset: radiusOffsetForNarrowLabel(size, text),
        font: size <= 300 ? "bold 12px Arial" : "bold 13px Arial",
        textAlign: "left"
      };
    }

    function setIncludeDisabled(disabled) {
      optionAot.disabled = disabled;
      optionWork.disabled = disabled;
    }

    function rebuildOptions() {
      var optionList = ["Coffee"];

      if (optionAot.checked) {
        optionList.push(SPECIAL_AOT);
      }

      optionList.push("Ice Cream", "Beer");

      if (optionWork.checked) {
        optionList.push(SPECIAL_WORK);
      }

      optionList.push("Tea");
      controller.setOptions(optionList);
    }

    controller = createWheelController({
      canvas: canvas,
      drawButton: drawButton,
      result: result,
      colors: DEFAULT_COLORS,
      beforeInteraction: unlockAudio,
      playTickSound: playTickSound,
      setControlsDisabled: setIncludeDisabled,
      getSectorSizeAt: getSectorSizeAt,
      isBypassOption: function (optionName) {
        return optionName === SPECIAL_AOT || optionName === SPECIAL_WORK;
      },
      getLabelLayout: getLabelLayout,
      onResult: function (label) {
        if (label === SPECIAL_AOT) {
          playAttackThemeCue();
        } else {
          stopAttackTheme();
        }
      },
      onButtonClick: function () {
        var resultIndex;
        var attackIndex;
        var availableIndexes = [];
        var optionList = controller.getOptions();
        var i;

        if (pendingAttackOnTitan && optionAot.checked) {
          attackIndex = controller.getIndexByLabel(SPECIAL_AOT);
          resultIndex = attackIndex >= 0 ? attackIndex : 0;
          pendingAttackOnTitan = false;
          controller.resetSelection();
          controller.spinToSector(resultIndex, 5, 1, false);
          return;
        }

        if (pendingBackToWorkFakeout && optionWork.checked) {
          pendingBackToWorkFakeout = false;
          controller.resetSelection();
          resultIndex = controller.getIndexByLabel(SPECIAL_WORK);
          if (resultIndex < 0) {
            controller.spinSelectedOrRandom(5, 1, true);
            return;
          }
          controller.spinToSector(resultIndex, 5, 1, true);
          return;
        }

        for (i = 0; i < optionList.length; i += 1) {
          if (optionList[i] !== SPECIAL_AOT && optionList[i] !== SPECIAL_WORK) {
            availableIndexes.push(i);
          }
        }

        if (!availableIndexes.length) {
          controller.spinSelectedOrRandom(5, 1, true);
          return;
        }

        controller.spinSelectedOrRandom(5, 1, true);
      }
    });

    function handleAotChange() {
      aotToggleCount += 1;
      if (aotToggleCount >= 5) {
        pendingAttackOnTitan = true;
        aotToggleCount = 0;
      }
      rebuildOptions();
    }

    function handleWorkChange() {
      workToggleCount += 1;
      if (workToggleCount > 5) {
        pendingBackToWorkFakeout = true;
        workToggleCount = 0;
      }
      rebuildOptions();
    }

    if (optionAot.addEventListener) {
      optionAot.addEventListener("change", handleAotChange, false);
      optionWork.addEventListener("change", handleWorkChange, false);
    } else {
      optionAot.onchange = handleAotChange;
      optionWork.onchange = handleWorkChange;
    }

    rebuildOptions();
  }

  function initTaskWheelPage() {
    var employeeCanvas = document.getElementById("employeeWheel");
    var employeeButton = document.getElementById("employeeDrawButton");
    var employeeResult = document.getElementById("employeeResult");
    var taskCanvas = document.getElementById("taskWheel");
    var taskButton = document.getElementById("taskDrawButton");
    var taskResult = document.getElementById("taskResult");
    var selectedEmployeeLabel = document.getElementById("selectedEmployeeLabel");
    var employeeWheel;
    var taskWheel;
    var currentEmployee = null;
    var currentTaskSpec = null;

    if (!employeeCanvas || !employeeButton || !employeeResult || !taskCanvas || !taskButton || !taskResult) {
      return;
    }

    function applyTaskSpec(employeeName) {
      currentEmployee = employeeName;
      currentTaskSpec = buildTaskSpec(employeeName);
      taskWheel.resetPosition();
      taskWheel.setOptions(currentTaskSpec.options);
      taskWheel.setResultText("");
      selectedEmployeeLabel.innerHTML = "Task pool: " + employeeName;
    }

    taskWheel = createWheelController({
      canvas: taskCanvas,
      drawButton: taskButton,
      result: taskResult,
      colors: ["#8b5e3c", "#d08a38", "#5c7994", "#4d8b71", "#8d637c", "#66753a"],
      getCanvasSize: function () {
        return window.innerWidth <= 900 ? 300 : 340;
      },
      getLabelLayout: function (text, sector, size) {
        return {
          rotateLabel: false,
          font: size <= 300 ? "bold 13px Arial" : "bold 14px Arial",
          maxWidth: size <= 300 ? 110 : 126,
          lineHeight: size <= 300 ? 15 : 17
        };
      },
      beforeSpinResolve: function (controllerInstance, source) {
        if (source === "button" && currentEmployee && currentTaskSpec && currentTaskSpec.refreshOnSpin) {
          applyTaskSpec(currentEmployee);
        }
      },
      isBypassOption: function (optionName, optionIndex) {
        if (!currentTaskSpec || !currentTaskSpec.bypassIndexes) {
          return false;
        }
        return currentTaskSpec.bypassIndexes.indexOf(optionIndex) >= 0;
      },
      resolveSpinPlan: function (spinPlan) {
        var allowedIndexes = [];
        var i;

        if (!currentTaskSpec) {
          return spinPlan;
        }

        if (currentTaskSpec.infiniteSpin) {
          return {
            requestedIndex: 0,
            spinDirection: spinPlan.spinDirection,
            mode: "infinite"
          };
        }

        if (currentTaskSpec.forceIndex !== undefined && currentTaskSpec.forceIndex !== null) {
          spinPlan.requestedIndex = currentTaskSpec.forceIndex;
          spinPlan.allowBypass = false;
          return spinPlan;
        }

        if (currentTaskSpec.randomOnly) {
          for (i = 0; i < currentTaskSpec.options.length; i += 1) {
            allowedIndexes.push(i);
          }
          spinPlan.requestedIndex = allowedIndexes[Math.floor(Math.random() * allowedIndexes.length)];
          spinPlan.allowBypass = false;
          return spinPlan;
        }

        return spinPlan;
      },
      onSpinStart: function () {
        if (currentTaskSpec && currentTaskSpec.meltOnSpin) {
          taskWheel.setDisplayTextMapper(function () {
            return "Melted";
          });
        }
      },
      onSpinEnd: function () {
        taskWheel.setDisplayTextMapper(null);
      }
    });

    employeeWheel = createWheelController({
      canvas: employeeCanvas,
      drawButton: employeeButton,
      result: employeeResult,
      colors: ["#6c584c", "#bc6c25", "#457b9d", "#588157", "#b56576", "#7f5539"],
      getCanvasSize: function () {
        return window.innerWidth <= 900 ? 300 : 340;
      },
      getLabelLayout: function (text, sector, size) {
        return {
          rotateLabel: false,
          font: size <= 300 ? "bold 14px Arial" : "bold 16px Arial",
          maxWidth: size <= 300 ? 88 : 96,
          lineHeight: size <= 300 ? 16 : 18
        };
      },
      onSpinStart: function () {
        taskWheel.setControlsLocked(true);
      },
      onSpinEnd: function () {
        taskWheel.setControlsLocked(false);
      },
      onResult: function (label) {
        applyTaskSpec(label);
      }
    });

    employeeWheel.setOptions(EMPLOYEE_NAMES);
    applyTaskSpec("Steve W");
  }

  initCoffeeWheelPage();
  initTaskWheelPage();
}());
