// === 完整整合版（包含：视频、拼贴、时间线、变速、播放控制、快捷键优化、新增播放指针与防重叠, 批量删除） ===

let video;
let selecting = true;
let isDragging = false;
let startX = 0, startY = 0, endX = 0, endY = 0;

let collageImages = [];
let selectedImage = null;
let selectedCollages = []; // 新增：用于多选框选的图片列表

let lockCollage = true;
let showVideo = true;
let isPlaying = false; 

let uiBar;
let fileInput, btnToggleSelect, btnToggleLock, btnToggleShow, btnExport;
let btnPlayPause; 
let btnDeleteSelected; // 新增：批量删除按钮

// === timeline & speed 新增变量 ===
let timelineHeight = 40; 
let tlMargin = 10; 
let handleRadius = 8; 
let hStartFrac = 0.0; 
let hEndFrac = 1.0;
let draggingHandle = null; 
let speeds = [0.25, 0.5, 0.75, 1, 2, 4];
let speedIndex = 3; 
let draggingSpeed = false; 

function setup() {
    createCanvas(1280, 720);
    clear(); 

    video = createVideo("", () => {});
    video.hide();
    video.elt.onpause = () => { isPlaying = false; updatePlayPauseButton(); };
    video.elt.onplay = () => { isPlaying = true; updatePlayPauseButton(); };
    
    // UI
    uiBar = createDiv().addClass("uibar");

    fileInput = createFileInput(handleFile, false);
    fileInput.parent(uiBar);

    btnPlayPause = createButton("▶ 播放").addClass("off");
    btnPlayPause.parent(uiBar);
    btnPlayPause.mousePressed(togglePlayPause);
    
    btnToggleSelect = createButton("框选：开").addClass("on");
    btnToggleSelect.parent(uiBar);
    btnToggleSelect.mousePressed(() => {
        selecting = !selecting;
        btnToggleSelect.html(selecting ? "框选：开" : "框选：关❌");
        toggleStyle(btnToggleSelect, selecting);
    });

    btnToggleLock = createButton("拼贴锁定：开").addClass("on");
    btnToggleLock.parent(uiBar);
    btnToggleLock.mousePressed(() => {
        lockCollage = !lockCollage;
        btnToggleLock.html(lockCollage ? "拼贴锁定：开" : "拼贴锁定：关❌");
        toggleStyle(btnToggleLock, lockCollage);

        if (!lockCollage) {
            selectedImage = null;
            selectedCollages = []; // 解锁时清空所有选择
        }
    });

    btnToggleShow = createButton("显示视频：开").addClass("on");
    btnToggleShow.parent(uiBar);
    btnToggleShow.mousePressed(() => {
        showVideo = !showVideo;
        btnToggleShow.html(showVideo ? "显示视频：开" : "显示视频：关");
        toggleStyle(btnToggleShow, showVideo);
    });
    
    // 新增批量删除按钮
    btnDeleteSelected = createButton("🗑 删除已选").addClass("off");
    btnDeleteSelected.parent(uiBar);
    btnDeleteSelected.mousePressed(deleteSelectedCollages);

    btnExport = createButton("导出 PNG").addClass("off");
    btnExport.parent(uiBar);
    btnExport.mousePressed(() => {
        // 1. 临时停止 draw 循环，防止在绘制内容时被覆盖
        noLoop();
        
        // 2. 执行一次仅包含内容（视频和拼贴）的绘制
        drawContentOnly();
        
        // 3. 导出画布
        saveCanvas("collage", "png");
        
        // 4. 恢复 draw 循环
        loop(); 
    });

    document.querySelector("canvas").style.position = "absolute";
    document.querySelector("canvas").style.top = "60px";

    video.speed(speeds[speedIndex]);
}

/**
 * 格式化秒数为 HH:MM:SS 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00:00";
    
    const h = floor(seconds / 3600);
    const m = floor((seconds % 3600) / 60);
    const s = floor(seconds % 60);
    
    // 使用 nf() 确保至少两位数
    return nf(h, 2) + ':' + nf(m, 2) + ':' + nf(s, 2);
}

/**
 * 核心内容绘制函数 (仅绘制视频和拼贴，用于导出)
 */
function drawContentOnly() {
    clear(); 

    // 绘制视频
    if (showVideo && video.elt && video.elt.src && video.elt.readyState >= 2) {
        image(video, 0, 0, width, height);
    }

    // 绘制拼贴图片
    for (let it of collageImages) {
        image(it.graphic, it.x, it.y, it.w, it.h);
        // NOTE: 选择框（UI元素）在此处被排除
    }
}


function draw() {
    
    // 获取视频时长和当前时间 (视频循环逻辑需要这些)
    let dur = (video && video.elt && video.elt.readyState >= 2) ? video.duration() || video.elt.duration || 0 : 0;
    let currentTime = (video && video.elt && video.elt.readyState >= 2) ? video.time() || 0 : 0;

    // 片段循环逻辑
    if (dur > 0) {
        let clipStart = constrain(hStartFrac * dur, 0, dur);
        let clipEnd = constrain(hEndFrac * dur, 0, dur);
        
        if (clipEnd - clipStart > 0.05) {
            if (currentTime >= clipEnd - 0.001) {
                try {
                    video.time(clipStart);
                } catch (e) { }
            }
        } else if (isPlaying) {
            togglePlayPause();
        }
    }

    // 绘制内容 (用于导出的部分)
    drawContentOnly();


    // ----------------------------------------------------
    // 以下是 UI 元素的绘制，它们不会被 drawContentOnly 包含
    // ----------------------------------------------------

    // 绘制拼贴图片的单选择框 UI (蓝色)
    for (let it of collageImages) {
        if (!lockCollage && selectedImage === it) {
            noFill();
            stroke(0, 150, 255);
            strokeWeight(2);
            rect(it.x, it.y, it.w, it.h);
        }
    }
    
    // 【新增】绘制多选图片的选择框 UI (橙色)
    for (let it of selectedCollages) {
        noFill();
        stroke(255, 180, 0); // 橙色/黄色
        strokeWeight(3);
        rect(it.x, it.y, it.w, it.h);
    }

    // 框选显示 UI (截图框, 蓝色)
    if (selecting && isDragging && !keyIsDown(SHIFT)) { // 避免与多选框重叠
        noFill();
        stroke(0, 160, 255);
        strokeWeight(2);
        rect(startX, startY, mouseX - startX, mouseY - startY);
    }
    
    // 【新增】多选框选显示 UI (橙色)
    if (keyIsDown(SHIFT) && isDragging) {
        noFill();
        stroke(255, 180, 0); // 橙色
        strokeWeight(2);
        rect(startX, startY, mouseX - startX, mouseY - startY);
    }

    // timeline 相关的像素信息
    let tlX = 0;
    let tlW = width;
    let tlY = height - timelineHeight - tlMargin;

    // ---------------------------
    // 绘制 timeline UI
    // ---------------------------
    push();
    // 背景条
    noStroke();
    fill(230);
    rect(tlX, tlY, tlW, timelineHeight);

    // 中心轨道 (较暗)
    let trackH = 8;
    let trackY = tlY + (timelineHeight - trackH) / 2;
    fill(200);
    rect(tlX + 10, trackY, tlW - 20, trackH, 3);

    // 滑块像素位置
    let sPx = map(hStartFrac, 0, 1, tlX + 10, tlX + tlW - 10);
    let ePx = map(hEndFrac, 0, 1, tlX + 10, tlX + tlW - 10);
    
    // 【新增】当前播放指针位置
    let pPx = map(currentTime, 0, dur, tlX + 10, tlX + tlW - 10);

    // 选区（蓝色半透明）
    fill(77, 163, 255, 160);
    rect(sPx, trackY, ePx - sPx, trackH);
    
    // ---------------------------
    // 绘制时间标签 (防重叠优化)
    // ---------------------------
    if (dur > 0) {
        let startTime = hStartFrac * dur;
        let endTime = hEndFrac * dur;
        let durationTime = endTime - startTime;
        let playTime = currentTime; 

        fill(0);
        textSize(12);

        // 绘制开始时间 (左侧，避免与滑块重叠，上移)
        textAlign(LEFT, BOTTOM);
        text(formatTime(startTime), sPx - handleRadius * 1.5, trackY - 10);
        
        // 绘制结束时间 (右侧，避免与滑块重叠，上移)
        textAlign(RIGHT, BOTTOM);
        text(formatTime(endTime), ePx + handleRadius * 1.5, trackY - 10);
        
        // 绘制总时长（选区中心，位于轨道内）
        if (ePx - sPx > 100) {
            fill(255); 
            textAlign(CENTER, CENTER);
            text(formatTime(durationTime), sPx + (ePx - sPx) / 2, trackY + trackH / 2);
        }

        // ---------------------------
        // 【新增】绘制当前播放时间标签
        // ---------------------------
        fill(255, 0, 0); // 红色
        textAlign(CENTER, TOP);
        // 标签位置在指针的上方
        text(formatTime(playTime), pPx, tlY - 10); 
    }
    // ---------------------------
    // 绘制滑块
    // ---------------------------
    
    fill(68);
    noStroke();
    rect(sPx - handleRadius, trackY - 6, handleRadius * 2, trackH + 12, 3);
    rect(ePx - handleRadius, trackY - 6, handleRadius * 2, trackH + 12, 3);

    // 小圆用于更明显
    fill(255);
    ellipse(sPx, trackY + trackH / 2, 6, 6);
    ellipse(ePx, trackY + trackH / 2, 6, 6);
    
    // ---------------------------
    // 【新增】绘制当前播放指针 (Playhead)
    // ---------------------------
    if (dur > 0) {
        stroke(255, 0, 0); // 红色线条
        strokeWeight(1);
        // 垂直线：从时间线顶部延伸到 canvas 底部
        line(pPx, tlY, pPx, height); 
        
        noStroke();
        fill(255, 0, 0); // 红色圆点
        ellipse(pPx, trackY + trackH/2, 8, 8);
    }
    // ---------------------------

    // 绘制速度滑杆 UI
    let sliderW = 300;
    let sliderX = (width - sliderW) / 2;
    let sliderY = tlY - 28;
    
    fill(245);
    rect(sliderX, sliderY, sliderW, 18, 6);
    
    for (let i = 0; i < speeds.length; i++) {
        let tx = map(i, 0, speeds.length - 1, sliderX + 6, sliderX + sliderW - 6);
        stroke(150);
        strokeWeight(1);
        line(tx, sliderY + 4, tx, sliderY + 12);
        noStroke();
        fill(i === speedIndex ? 0 : 120); 
        textAlign(CENTER, BOTTOM);
        textSize(12);
        text(speeds[i] + "x", tx, sliderY - 2);
    }
    
    let kx = map(speedIndex, 0, speeds.length - 1, sliderX + 6, sliderX + sliderW - 6);
    fill(68);
    rect(kx - 6, sliderY + 1, 12, 16, 4);
    
    pop();
}

/**
 * 【新增】删除所有被选中的拼贴
 */
function deleteSelectedCollages() {
    if (selectedCollages.length === 0) return;
    
    // 创建一个 Set 集合，用于快速查找需要删除的元素
    const toDeleteSet = new Set(selectedCollages);
    
    // 过滤 collageImages，只保留不在 toDeleteSet 中的图片
    collageImages = collageImages.filter(it => !toDeleteSet.has(it));
    
    // 清空选择状态
    selectedCollages = [];
    selectedImage = null; 
}


// ---------------------------
// 辅助函数
// ---------------------------

function togglePlayPause() {
    if (!video.elt.src || video.elt.readyState < 2) return; 

    if (isPlaying) {
        try { video.pause(); } catch(e) {}
    } else {
        try { 
            video.loop(); 
            video.play();
        } catch(e) {}
    }
}

function updatePlayPauseButton() {
    if (isPlaying) {
        btnPlayPause.html("⏸ 暂停");
        toggleStyle(btnPlayPause, true);
    } else {
        btnPlayPause.html("▶ 播放");
        toggleStyle(btnPlayPause, false);
    }
}

function toggleStyle(btn, on) {
    btn.removeClass("on");
    btn.removeClass("off");
    btn.addClass(on ? "on" : "off");
}

function handleFile(file) {
    if (file.type === "video") {
        video.attribute("src", file.data);
        video.elt.load();
        
        video.speed(speeds[speedIndex]);

        try { video.pause(); } catch(e) {}
        isPlaying = false;
        updatePlayPauseButton();

        try { video.loop(); } catch(e) {}
        try { video.volume(0); } catch(e) {}

        showVideo = true;
        toggleStyle(btnToggleShow, true);
        
        hStartFrac = 0.0;
        hEndFrac = 1.0;
    }
}

// ---------------------------
// 鼠标事件 (时间线拖动实时预览)
// ---------------------------

function mousePressed() {
    if (mouseY < 60) return;

    let tlX = 0;
    let tlW = width;
    let tlY = height - timelineHeight - tlMargin;
    let trackH = 8;
    let trackY = tlY + (timelineHeight - trackH) / 2;
    let sPx = map(hStartFrac, 0, 1, tlX + 10, tlX + tlW - 10);
    let ePx = map(hEndFrac, 0, 1, tlX + 10, tlX + tlW - 10);

    // 时间线滑块检测
    if (mouseY >= trackY - 10 && mouseY <= trackY + trackH + 10) {
        if (isPlaying) togglePlayPause();

        if (abs(mouseX - sPx) <= 12) {
            draggingHandle = "start";
            return; 
        }
        if (abs(mouseX - ePx) <= 12) {
            draggingHandle = "end";
            return;
        }
        if (mouseX > sPx + 12 && mouseX < ePx - 12) {
            draggingHandle = "moveRange";
            this._rangeMoveOffset = mouseX;
            this._origStart = hStartFrac;
            this._origEnd = hEndFrac;
            return;
        }
    }

    // 速度滑杆检测
    let sliderW = 300;
    let sliderX = (width - sliderW) / 2;
    let sliderY = tlY - 28;
    if (mouseY >= sliderY && mouseY <= sliderY + 18 && mouseX >= sliderX && mouseX <= sliderX + sliderW) {
        let rel = map(mouseX, sliderX + 6, sliderX + sliderW - 6, 0, speeds.length - 1);
        let idx = round(constrain(rel, 0, speeds.length - 1));
        speedIndex = idx;
        try { video.speed(speeds[speedIndex]); } catch(e) {}
        draggingSpeed = true;
        return;
    }

    // 【新增】如果按下了 SHIFT 键，开始多选框选，忽略单选和截图
    if (keyIsDown(SHIFT)) {
        // 如果不是在拖动拼贴，则准备开始多选框选
        if (!collageImages.some(it => it.dragging) && !lockCollage) {
            isDragging = true;
            startX = mouseX;
            startY = mouseY;
        }
        // 立即返回，不执行单选或截图逻辑
        return;
    }

    // === 拼贴点击逻辑 (单选) ===
    selectedImage = null; 
    selectedCollages = []; // 单选时清空多选状态

    if (!lockCollage) {
        for (let i = collageImages.length - 1; i >= 0; i--) {
            let it = collageImages[i];
            if (mouseX > it.x && mouseX < it.x + it.w &&
                mouseY > it.y && mouseY < it.y + it.h) {

                it.dragging = true;
                selectedImage = it;
                it.offsetX = mouseX - it.x;
                it.offsetY = mouseY - it.y;

                collageImages.splice(i, 1);
                collageImages.push(it);
                return;
            }
        }
    }

    if (selecting) {
        isDragging = true;
        startX = mouseX;
        startY = mouseY;
    }
}

function mouseDragged() {
    if (draggingHandle) {
        let tlX = 0;
        let tlW = width;
        let left = tlX + 10;
        let right = tlX + tlW - 10;
        let rangeLength = 0; 
        let newFrac = 0; 

        if (draggingHandle === "start") {
            let frac = map(mouseX, left, right, 0, 1);
            hStartFrac = constrain(frac, 0, hEndFrac - 0.001);
            newFrac = hStartFrac; 
        } else if (draggingHandle === "end") {
            let frac = map(mouseX, left, right, 0, 1);
            hEndFrac = constrain(frac, hStartFrac + 0.001, 1);
            newFrac = hEndFrac; 
        } else if (draggingHandle === "moveRange") {
            rangeLength = this._origEnd - this._origStart;
            
            let dx = mouseX - this._rangeMoveOffset;
            let tlWpix = right - left;
            let dFrac = dx / tlWpix;
            
            let newStart = constrain(this._origStart + dFrac, 0, 1 - rangeLength);
            
            hStartFrac = newStart;
            hEndFrac = newStart + rangeLength;

            newFrac = hStartFrac; 
        }
        
        // 视频时间同步逻辑
        if (video.elt.src && video.duration()) {
             let dur = video.duration();
             let currentVideoTime = dur * newFrac;
             currentVideoTime = constrain(currentVideoTime, 0, dur - 0.001);
             try { 
                 video.time(currentVideoTime);
             } catch (e) {}
        }
        
        return; 
    }

    if (draggingSpeed) {
        let sliderW = 300;
        let sliderX = (width - sliderW) / 2;
        let rel = map(mouseX, sliderX + 6, sliderX + sliderW - 6, 0, speeds.length - 1);
        let idx = round(constrain(rel, 0, speeds.length - 1));
        if (idx !== speedIndex) {
            speedIndex = idx;
            try { video.speed(speeds[speedIndex]); } catch(e) {}
        }
        return;
    }

    // 原拼贴拖动逻辑
    for (let it of collageImages) {
        if (it.dragging) {
            it.x = mouseX - it.offsetX;
            it.y = mouseY - it.offsetY;
            return;
        }
    }
}

function mouseReleased() {
    if (draggingHandle) {
        draggingHandle = null;
        this._rangeMoveOffset = null;
        this._origStart = null;
        this._origEnd = null;
        return;
    }
    if (draggingSpeed) {
        draggingSpeed = false;
        return;
    }

    for (let it of collageImages) it.dragging = false;
    
    // 【新增】多选框选结束逻辑 (按住 SHIFT 键)
    if (keyIsDown(SHIFT) && isDragging) {
        isDragging = false;
        
        let selX = min(startX, mouseX);
        let selY = min(startY, mouseY);
        let selW = abs(mouseX - startX);
        let selH = abs(mouseY - startY);
        
        if (selW < 5 || selH < 5) {
            // 如果是微小点击，清空多选状态
            selectedCollages = [];
            return;
        }

        // 框选模式下，清空单选
        selectedImage = null;
        selectedCollages = [];

        for (let it of collageImages) {
            // AABB 碰撞检测：检查拼贴矩形是否与选择框重叠
            if (selX < it.x + it.w &&
                selX + selW > it.x &&
                selY < it.y + it.h &&
                selY + selH > it.y) {
                
                selectedCollages.push(it);
            }
        }
        return; // 结束多选逻辑
    }


    if (selecting && isDragging) {
        isDragging = false;

        let x = min(startX, mouseX);
        let y = min(startY, mouseY);
        let w = abs(mouseX - startX);
        let h = abs(mouseY - startY);

        if (w < 10 || h < 10) return;

        let g = createGraphics(w, h);
        g.clear();

        // 修复：确保在截图时视频处于可读状态
        if (video.elt.readyState >= 2) {
            // 确保 video 元素内容被正确绘制到 graphics buffer
            g.image(video, -x, -y, width, height); 
        }

        collageImages.push({
            graphic: g,
            x, y, w, h,
            dragging: false
        });
    }
}

// ---------------------------
// 键盘事件
// ---------------------------

function keyPressed() {
    // 空格键：切换播放/暂停
    if (keyCode === 32) { 
        togglePlayPause();
        return false; 
    }

    if (lockCollage) {
        if (keyCode !== RIGHT_ARROW && keyCode !== LEFT_ARROW) return;
    }

    // 删除逻辑：如果有多选，优先删除多选；否则删除单选
    if (keyCode === DELETE || keyCode === BACKSPACE) {
        if (selectedCollages.length > 0) {
            deleteSelectedCollages();
        } else if (selectedImage) {
            collageImages = collageImages.filter(it => it !== selectedImage);
            selectedImage = null;
        }
    } 
    
    // 微调逻辑
    if (video.elt.src && video.duration()) {
        const dur = video.duration();
        const step = 1 / 30; 
        let currentTime = video.time();

        if (keyCode === RIGHT_ARROW) {
            if (isPlaying) togglePlayPause(); 
            currentTime = constrain(currentTime + step, 0, dur - 0.001);
            try { video.time(currentTime); } catch(e) {}
        } else if (keyCode === LEFT_ARROW) {
            if (isPlaying) togglePlayPause(); 
            currentTime = constrain(currentTime - step, 0, dur - 0.001);
            try { video.time(currentTime); } catch(e) {}
        }
    }
}