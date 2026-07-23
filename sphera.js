class PanoramaViewer {
    constructor(options) {
        this.container = options.container;
        this.imageSrc = options.image;

        // Создаем встроенный легкий 3D-движок на чистом WebGL
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

        if (!this.gl) {
            this.container.innerHTML = "<div style='color:white;text-align:center;padding:20px;'>WebGL не поддерживается вашим браузером.</div>";
            return;
        }

        this.lon = 0; this.lat = 0;
        this.isUserInteracting = false;
        this.startX = 0; this.startY = 0;
        this.startLon = 0; this.startLat = 0;

        this.img = new Image();
        this.img.onload = () => this.init();
        this.img.src = this.imageSrc;
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Простая и надежная компиляция 3D-шейдеров сферы
        const vs = `attribute vec3 p; varying vec3 v; void main() { v = p; gl_Position = vec4(p.x, p.y, 1.0, 1.0); }`;
        const fs = `precision mediump float; uniform sampler2D t; uniform vec2 r; uniform vec2 rot; varying vec3 v;
            void main() {
                float lon = v.x * 3.1415926 + rot.x; float lat = v.y * 1.5707963 + rot.y;
                vec3 d = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
                float pLon = atan(d.x, d.z); float pLat = asin(d.y);
                vec2 uv = vec2((pLon + 3.1415926) / 6.2831852, (1.5707963 - pLat) / 3.1415926);
                gl_FragColor = texture2D(t, uv);
            }`;

        const vShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vShader, vs); this.gl.compileShader(vShader);
        const fShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fShader, fs); this.gl.compileShader(fShader);

        this.prog = this.gl.createProgram();
        this.gl.attachShader(this.prog, vShader); this.gl.attachShader(this.prog, fShader);
        this.gl.linkProgram(this.prog); this.gl.useProgram(this.prog);

        const buf = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1,0, -1,1,0, 1,-1,0, 1,-1,0, -1,1,0, 1,1,0]), this.gl.STATIC_DRAW);

        const pLoc = this.gl.getAttribLocation(this.prog, "p");
        this.gl.enableVertexAttribArray(pLoc);
        this.gl.vertexAttribPointer(pLoc, 3, this.gl.FLOAT, false, 0, 0);

        this.tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.img);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        this.rotLoc = this.gl.getUniformLocation(this.prog, "rot");

        this.container.addEventListener('pointerdown', (e) => {
            this.isUserInteracting = true; this.startX = e.clientX; this.startY = e.clientY;
            this.startLon = this.lon; this.startLat = this.lat;
        });
        window.addEventListener('pointermove', (e) => {
            if (!this.isUserInteracting) return;
            // Управление обзором с идеальными пропорциями и скоростью
            this.lon = this.startLon - (e.clientX - this.startX) * 0.005;
            this.lat = this.startLat + (e.clientY - this.startY) * 0.005;
            this.lat = Math.max(-1.4, Math.min(1.4, this.lat));
        });
        window.addEventListener('pointerup', () => this.isUserInteracting = false);

        this.render();
    }

    resize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        requestAnimationFrame(() => this.render());
        this.gl.uniform2f(this.rotLoc, this.lon, this.lat);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
}
