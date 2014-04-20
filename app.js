/* jshint browser:true, devel:true, unused:false, laxcomma: true */

if (! window.AudioContext) {
    if (! window.webkitAudioContext) {
        alert("Browser doesn't support AudioContext. This won't work. Sorry!");
    }
    window.AudioContext = window.webkitAudioContext;
}

(function($){
    
    var $canvas = $('#canvas');
    $canvas[0].width =  $(window).width() - 20;
    $canvas[0].height = $(window).height() - 20;

    var $urlInput = $('input#url')
        , $loadButton = $('#load-song')
        , $stopButton = $('#stop-song')
        , $soundCloudAttribution = $('a#soundcloud-attribution')
        , $soundCloudArtist = $('a#soundcloud-artist')
        , canvasWidth = $canvas[0].width
        , canvasHeight = $canvas[0].height
        , cx = canvasWidth / 2
        , cy = canvasHeight / 2
        , canvasCtx = $canvas[0].getContext('2d')
        , radialGradient = canvasCtx.createRadialGradient(cx, cy, 1, cx, cy, 100)
        , defaultUrl = 'https://soundcloud.com/neus/pharrell-williams-happy-neus'
        , SC_CLIENT_ID = '0b09c326bf9fb0340580dde2fae204eb'
        , SC_PROXY_URL = 'http://sc-viz-proxy.herokuapp.com/stream?url='
    ;

    // configure the radial gradient
    radialGradient.addColorStop(0, "yellow");
    radialGradient.addColorStop(1, "#F73318");

    // The SoundCloud Resolver Class
    function SoundCloudResolver() {
        var resolverTemplate = 'http://api.soundcloud.com/resolve.json?client_id='+SC_CLIENT_ID+'&url=';
        
        this.resolve = function(url, callbackFn) {
            console.info("Resolving", url);
            $loadButton.text('Loading');
            $.ajax({
                url : resolverTemplate + url
                , success : function(data, textStatus, jsXHR) {
                    try {
                        console.info(data);
                        // show attribution                        
                        $soundCloudArtist.attr('href', data.permalink_url);
                        $soundCloudArtist.find('img').attr('src', data.artwork_url);
                        $soundCloudArtist.addClass('active');
                        $soundCloudAttribution.addClass('slide-left');
                        // start the player                        
                        callbackFn.call(callbackFn.this, data.stream_url + '?client_id='+SC_CLIENT_ID);
                    } catch(ex) {
                        alert("Unable to fetch sound cloud data :/");
                        console.error(ex);
                    }
                }, error : function() {
                    alert("Unable to fetch sound cloud data :/");
                    console.error(arguments);
                    $loadButton.text('Load');
                }
            });
        };
    }

    // the visualizer class
    function Visualizer(options) {
        // set up the options
        var defaultOptions = {
            style : 'radial'
            , smoothingTimeConstant: 0.3
            , fftSize: 32
        };
        this.options = options = $.extend(defaultOptions, options || {});

        // initialize the audiocontext
        this.audioContext = new window.AudioContext();

        // the soundcloud resolver object to get the streaming file location
        this.soundCloudResolver = new SoundCloudResolver();

        // set up the script processor
        this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.scriptProcessor.connect(this.audioContext.destination);
        this.scriptProcessor.onaudioprocess = $.proxy(function() {
            var data =  new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(data);
            
            // reset the canvas...            
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
            canvasCtx.fillStyle = radialGradient;
            canvasCtx.fill();

            // draw something..
            if (options.style === 'radial') {
                this.drawCirle(data);
            }

        }, this);

        // setup analyzer        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.smoothingTimeConstant = options.smoothingTimeConstant;
        this.analyser.fftSize = options.fftSize;
        this.analyser.connect(this.scriptProcessor);

        this.stopPlayer = function() {
            try {
                this.bufferSource.stop();
            }catch(ex){}
            $stopButton.removeClass('active');
            $loadButton.removeClass('slide-left');
            $soundCloudArtist.removeClass('active');
            $soundCloudAttribution.removeClass('slide-left');
        };

        this.init = function() {
            $loadButton.on('click', $.proxy(function(e){
                var url = $urlInput.val() || defaultUrl;
                this.stopPlayer();
                this.soundCloudResolver.resolve(url, this.streamAudio.bind(this));
            }, this));
            $stopButton.on('click', $.proxy(this.stopPlayer, this));
            return this;
        };

        this.streamAudio = function(streamUrl) {
            var request = new XMLHttpRequest(),
                proxyUrl = SC_PROXY_URL + streamUrl,
                visualizerContext = this;

            // setup buffer source
            this.bufferSource = this.audioContext.createBufferSource();
            this.bufferSource.connect(this.audioContext.destination);
            this.bufferSource.connect(this.analyser);

            // XHR2 check
            if (!request.upload) {
                console.error("XHR2 not supported.");
                alert("Sorry this browser won't work for this. Try a modern browser.");
            }

            // begin binary stream
            request.open('GET', proxyUrl, true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
                // decode the data
                visualizerContext.audioContext.decodeAudioData(request.response, function(buffer) {
                    // when the audio is decoded play the sound
                    visualizerContext.bufferSource.buffer = buffer;
                    visualizerContext.bufferSource.start(0);
                    // begin visual code
                    $loadButton.text('Load');
                    $loadButton.addClass('slide-left');
                    $stopButton.addClass('active');
                }, function(){
                    console.error(arguments);
                });
            };
            request.send();
        };

        this.toRadians = function(deg) {
            return deg * Math.PI / 180;
        };

        this.drawCirle = function(array) {
            var anglePerSlice = 360 / array.length;
            var angle = 0;

            for (var i = 0; i < array.length; i++) {
              var value = array[i];
              canvasCtx.beginPath();
              canvasCtx.moveTo(cx,cy);
              canvasCtx.arc(cx, cy, value + 100, this.toRadians(angle), this.toRadians(angle + anglePerSlice), false);
              canvasCtx.closePath();
              canvasCtx.fill();
              canvasCtx.lineWidth = 0.1;
              canvasCtx.strokeStyle = 'yellow';
              canvasCtx.stroke();
              angle += anglePerSlice;
          }
        };
    }
    window.v = new Visualizer({ style: 'radial' }).init();

}(jQuery));