var shadersToLoad = 2;
var shaders = {vertex: '', fragment: ''};
var camera, dummyCamera, scene, controls, renderer;
var geometry, material, mesh;
var mouse = new THREE.Vector2( 0.5, 0.5 );
var canvas;
var stats; //For tracking framerate and other stats
var clock = new THREE.Clock();
var texture; //OpenGL texture used to pass grid data to the shader
var gl; //OpenGL context object
var ROW_SIZE = 256;
var COL_SIZE = 256;
var playing = false;
var stepId = 0;
var mouseButtonPressed = false;
var configGridHistory = [];
var maxConfigGridHistory = 1024;

//Used for toggling cells in the scene by clicking on them
//i.e. 'edit mode'
var pixelData = new Float32Array(4);
var hoverCell = new THREE.Vector2();
var editModeActive = false;
var pauseAtNextStep = false;
var pauseDelayRemaining = 0;
var cellsModifiedThisDrag = [];
var playingBeforeEditMode = true;

//A three dimensional array. Holds an array of 'row' arrays, each
//element of which is a four component array carrying data for a
//particular cell in the grid. The four components are:
// 0) A one or zero indicating whether the cell is live or dead.
// 1) Unused at the moment.
// 2) A one if the cell's life/death state changed this turn; otherwise a zero.
// 3) Unused at the moment.
//Note: something seems to be depending on the fact that [2] stores the particular info.
//that it does in a way I haven't been able to track down. I tried switching it to be
//stored in [1] instead so both unused elements would be at the end (and I updated the
//references here and in the shader which I could find)—but the animation breaks in
//some strange way when I try it.
var grid = [];

//Tracks cells that switched from dead to alive (or the
//reverse) during the most recent step of the game.
var toggledCells = []; 
var timeSinceGameUpdate = 0;
var stepTime = 1; //This value will be overriden in setUpSpeedSlider()
var stepCompletion = 0;
var configFileList = [];
var mousePos = new THREE.Vector2();
var renderTarget;

init();

function init() {
  $(document).ready(function () {
    setUpConfigFileDropdown();
    setUpSpeedSlider();
    setUpButtons();
    doConditionalLayoutMods();
  });
}

function initThreejs() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();
  dummyCamera = new THREE.Camera();
  camera.position.set(-21.6, 77.503, 186.829);
  geometry = new THREE.PlaneBufferGeometry( 2.0, 2.0 );
  canvas = document.getElementById("canvas");
  renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setPixelRatio( window.devicePixelRatio );
  gl = renderer.getContext();

  var renderTargetParams = {
    minFilter:THREE.NearestFilter,
    stencilBuffer:false,
    depthBuffer:false,
    format: THREE.RGBAFormat,
    type: THREE.FloatType
  }
  renderTarget = new THREE.WebGLRenderTarget( 1, 1, renderTargetParams );

  loadShader('shaders/vertex.js', 'vertex');
  loadShader('shaders/fragment.js', 'fragment');
  
  controls = new THREE.OrbitControls( camera, canvas );
  controls.target = new THREE.Vector3(2.645, -54.83, 36.876);
  controls.enableZoom = true;
  stats = new Stats();
}

function setUpButtons() {
  $('.pause-btn').click(function(e) {
    pause();
  });

  $('.play-btn').css('opacity', '0.5');
  $('.play-btn').click(function(e) {

    //We do this so that when the user presses the play button, they can count on Conway's
    //rules being what evolves the grid, rather than their own personal history (which is
    //what you get—if it exists—when using the step forward button).
    configGridHistory.length = stepId;
    play();
  });

  $('.clear-btn').click(function(e) {
    clearGrid();
  });

  $('.random-btn').click(function(e) {
    timeSinceGameUpdate = 0;
    loadRandomGrid();
  });

  $('.forward-btn').click(function(e) {
    stepForwardAction();
    pause();
  });

  $('.back-btn').click(function(e) {
    stepBackwardAction();
    pause();
  });
}

function stepForwardAction() {
  if (stepId < configGridHistory.length-1) { //load from history
    stepId++;
    var configGrid = configGridHistory[stepId];
    copyConfigGridIntoGrid(ROW_SIZE, COL_SIZE, configGrid, grid);
  } else {
    stepConwaysGame(grid);
  }

  if (!playing) {
    clearCellAnimationStates();
  }
  updateDataTextureFromGrid(grid);
  stepCompletion = 0.00;
  timeSinceGameUpdate = 0;
}

function stepBackwardAction() {
  if (stepId <= 0) {
    return;
  }

  stepId--;
  var configGrid = configGridHistory[stepId];
  copyConfigGridIntoGrid(ROW_SIZE, COL_SIZE, configGrid, grid);

  if (!playing) {
    clearCellAnimationStates();
  }
  updateDataTextureFromGrid(grid);
  stepCompletion = 0.01;
  timeSinceGameUpdate = stepCompletion * stepTime;
}

function play() {
  playing = true;
  $('.pause-btn').css('opacity', '1');
  $('.play-btn').css('opacity', '0.5');
}

function pause() {
  playing = false;
  $('.pause-btn').css('opacity', '0.5');
  $('.play-btn').css('opacity', '1');
}

function setUpSpeedSlider() {
  var speedSlider = $('.speed-slider');

  var updateStepTime = function(sliderVal) {
    var oldStepCompletionRatio = timeSinceGameUpdate / stepTime;

    //The slider component gives values between zero and 100, but we don't want it
    //to give totally linear values, so we map into two different ranges: when between
    //0 and 'threshold' the values are between max and firstRangeMax; when between 'threshold'
    // and 'sliderMax' the values are between firstRangeMax and min. The range endpoints are
    //reversed because we are changing 'stepTime', but from the user's perspective
    //the slider measures speed.
    var sliderMax = 100;
    var threshold = 30;
    var min = 25;
    var firstRangeMax = 700;
    var max = 3000;

    if (sliderVal > threshold) {
      var scale = 1 - ((sliderVal-threshold)/(sliderMax - threshold));
      stepTime = min + (firstRangeMax - min)*scale;
    } else {
      var scale = 1 - (sliderVal / threshold);
      stepTime = firstRangeMax + (max - firstRangeMax)*scale;
    }

    timeSinceGameUpdate = oldStepCompletionRatio * stepTime;
  }

  speedSlider.on('input', function(e) {
    var val = speedSlider.val();
    updateStepTime(val);
  });

  speedSlider.val(50) //set initial value
  updateStepTime(speedSlider.val());
}

function setUpEditModeEvents() {
  $('canvas').mousemove(function(e) {
    mousePos.x = e.offsetX;
    mousePos.y = canvas.height - e.offsetY;

    if (editModeActive && mouseButtonPressed) {
      toggleCellWithCursor();
    }
  });

  $(document).keydown(function(e) {
    if (e.which === 16) { //Shift key
      beginEditMode();
    }
  });

  $(document).keyup(function(e) {
    if (e.which === 16) { //Shift key
      endEditMode();
    } else if (e.which === 69) { //'e' key

      editModeActive = !editModeActive;

      if (editModeActive) {
        beginEditMode();
      } else {
        endEditMode();
      }
    }
  });

  $('canvas').click(function(e) {
    $('canvas').focus();
    if (editModeActive) {
      toggleCellWithCursor();
    }
  });

  $('canvas').mousedown(function(e) {
    mouseButtonPressed = true;
    cellsModifiedThisDrag = [];
  });

  $('canvas').mouseup(function(e) {
    mouseButtonPressed = false;
  });

  $('canvas').mouseout(function(e) {
    if (editModeActive) {
      endEditMode();
    }
  });
}

function configGridFromGrid(grid) {
  var newGrid = [COL_SIZE];

  for (var i = 0; i < grid.length; i++) {
    var row = grid[i]
    var newRow = new Array(ROW_SIZE);

    for (var j = 0; j < row.length; j++) {
      newRow[j] = row[j][0];
    }
    newGrid[i] = newRow;
  }

  return newGrid;
}

function beginEditMode() {
  editModeActive = true;
  playingBeforeEditMode = playing;
  controls.enabled = false;
  initiatePauseAtNextStep();
}

function endEditMode() {
  editModeActive = false;
  if (playingBeforeEditMode) {
    play();
  }
  pauseAtNextStep = false;
  controls.enabled = true;
}

function initiatePauseAtNextStep() {
  pauseAtNextStep = true;
  pauseDelayRemaining = stepTime - timeSinceGameUpdate;
}

function clearGrid() {
  for (var i = 0; i < grid.length; i++) {
    var row = grid[i];

    for (var j = 0; j < row.length; j++) {
      var cell = row[j];
      cell[0] = 0;
      cell[1] = 0;
      cell[2] = 0;
      cell[3] = 0;
    }
  }

  updateDataTextureFromGrid(grid);
}

function clearCellAnimationStates() {
  for (var i = 0; i < grid.length; i++) {
    var row = grid[i];

    for (var j = 0; j < row.length; j++) {
      var cell = row[j];
      cell[1] = 0;
      cell[2] = 0;
      cell[3] = 0;
    }
  }

  updateDataTextureFromGrid(grid);
}

function toggleCellWithCursor() {

  var row = (hoverCell.y + COL_SIZE/2) % COL_SIZE;
  var col = (hoverCell.x + ROW_SIZE/2) % ROW_SIZE;

  for (var i = 0; i < cellsModifiedThisDrag.length; i+=2) {
    var aRow = cellsModifiedThisDrag[i];
    var aCol = cellsModifiedThisDrag[i+1];

    if (row === aRow && col === aCol) {
      return;
    }
  }
  
  cellsModifiedThisDrag.push(row);
  cellsModifiedThisDrag.push(col);

  var cell = grid[row][col];
  
  if (cell[0] === 1) { //The cell was alive previously

    //Give the cell a 'dead' state, without animating
    cell[0] = 0;
    cell[1] = 0;
    cell[2] = 0;
    cell[3] = 0;
  } else {

    //Give the cell a 'living' state, without animating
    cell[0] = 1;
    cell[1] = 1;
    cell[2] = 0;
    cell[3] = 0;
  }

  updateDataTextureFromGrid(grid);
}

function shadersFinishedLoading() {
  initMaterial();
  initGrid();

  playing = true;
}

function initMaterial() {
  var theOffsets = new Float32Array(ROW_SIZE*COL_SIZE*4);
  texture = textureFromFloats(gl, ROW_SIZE, COL_SIZE, theOffsets);
  texture.needsUpdate = true;

  material = new THREE.RawShaderMaterial( {
    uniforms: {
      iResolution: { value: new THREE.Vector2( canvas.width, canvas.height ) },
      cameraPos:  { value: camera.getWorldPosition() },
      cameraDir:  { value: camera.getWorldDirection() },
      offsets: {type: "fv", value: theOffsets},
      tex: {type: "t", value: texture},
      stepCompletion: {value: stepCompletion},
      mousePos: {value: mousePos},
      pickPass: {value: false},
      hoverCell: {value: hoverCell}
    },
    vertexShader: shaders['vertex'],
    fragmentShader: shaders['fragment']
  } );

  mesh = new THREE.Mesh( geometry, material );
  scene.add( mesh );
}

function textureFromFloats(gl,width,height,float32Array) 
{
  return new THREE.DataTexture(float32Array, width, height, THREE.RGBA, THREE.FloatType, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.NearestFilter, THREE.NearestFilter, 1);
}

function initGrid() {
  loadRandomGrid();
}

function loadRandomGrid() {
  var configGrid = [];

  //Fill the config grid with random live and dead cells
  for (var i = 0; i < COL_SIZE; i++) {

    var row = [];
    for (var j = 0; j < ROW_SIZE; j++) {

      var val = Math.random();
      if (val < .61803) {
        val = 1;
      } else {
        val = 0;
      }

      row[j] = val;
    }

    configGrid[i] = row;
  }

  copyConfigGridIntoGrid(ROW_SIZE, COL_SIZE, configGrid, grid);
}

function stepConwaysGame(grid) {
  saveGridStateToHistory();
  clearRecentlyToggledIndicators();
  toggledCells.length = 0;

  for (var i = 0; i < COL_SIZE; i++) {
    for (var j = 0; j < ROW_SIZE; j++) {

      var oldState = grid[i][j][0];
      var alive = oldState === 1;
      var neighborCount = liveNeighborCount(grid, i, j);

      var newState = newCellState(alive, neighborCount);
      
      //We don't immediately toggle cells because it would effect the application
      //of rules to other cells during this step of the game.
      if (newState !== oldState) {
        toggledCells.push(i);
        toggledCells.push(j);
      }
    }
  }

  //Actually toggle any cells that should be toggled now
  for (var i = 0; i < toggledCells.length; i+=2) {
    var row = toggledCells[i];
    var col = toggledCells[i+1];
    var cell = grid[row][col];

    if (cell[0] === 1) {
      newState = 0;
    } else {
      newState = 1;
    }
    cell[0] = newState;
    cell[2] = 1; //Indicates that its state changed this turn
  }

  stepId++;
}

function saveGridStateToHistory() {
  configGridHistory[stepId] = configGridFromGrid(grid);
  if (configGridHistory.length >= maxConfigGridHistory) {
    configGridHistory.shift();
    stepId--;
  }
}

function newCellState(alive, neighborCount) {
  if (alive && neighborCount < 2) {
    return 0;
  } else if (alive && (neighborCount === 2 || neighborCount === 3)) {
    return 1;
  } else if (alive && neighborCount > 3) {
    return 0;
  } else if (!alive && neighborCount === 3) {
    return 1;
  } else {
    return 0;
  }
}

function liveNeighborCount(grid, row, col) {
  var leftNeighbor = 0;
  var rightNeighbor = 0;
  var topNeighbor = 0;
  var bottomNeighbor = 0;
  var ulNeighbor = 0;
  var llNeighbor = 0;
  var urNeighbor = 0;
  var lrNeighbor = 0;

  if (col > 0) {
    leftNeighbor = grid[row][col-1][0];
  }
  if (col < ROW_SIZE-1) {
    rightNeighbor = grid[row][col+1][0];
  }
  if (row > 0) {
    bottomNeighbor = grid[row-1][col][0];
  }
  if (row < COL_SIZE-1) {
    topNeighbor = grid[row+1][col][0];
  }
  if (row < COL_SIZE-1 && col > 0) {
    ulNeighbor = grid[row+1][col-1][0]; 
  }
  if (row > 0 && col > 0) {
    llNeighbor = grid[row-1][col-1][0]; 
  }
  if (row < COL_SIZE-1 && col < ROW_SIZE-1) {
    urNeighbor = grid[row+1][col+1][0]; 
  }
  if (row > 0 && col < ROW_SIZE-1) {
    lrNeighbor = grid[row-1][col+1][0]; 
  }

  return leftNeighbor + rightNeighbor + topNeighbor + bottomNeighbor +
         ulNeighbor + llNeighbor + urNeighbor + lrNeighbor;
}

function updateDataTextureFromGrid(grid) {
  var vectorCount = texture.image.data.length / 4;
  for (var i = 0; i < texture.image.data.length; i+=4) {

    //Each cell in the grid has four floats of data in the texture
    var cellIndex = i/4;
    var row = Math.floor(cellIndex / ROW_SIZE);
    var col = cellIndex % ROW_SIZE;
    texture.image.data[i] = grid[row][col][0];
    texture.image.data[i+1] = grid[row][col][1];
    texture.image.data[i+2] = grid[row][col][2];
    texture.image.data[i+3] = grid[row][col][3];
  }
  texture.needsUpdate = true;
}

function clearRecentlyToggledIndicators() {
  for (var i = 0; i < toggledCells.length; i+= 2) {
    var row = toggledCells[i];
    var col = toggledCells[i+1];

    grid[row][col][2] = 0;
  }
}

function sinEase(t, start, end) {
  return -(end-start)/2 * (Math.cos(Math.PI*t) - 1) + start;
}

function setUpConfigFileDropdown() {
  $.ajax({
    //Retrieve a list of the files/folders at the given url
    url: './configs',
    success: function (data) {
      $(data).find("a:contains(" + ".l" + ")").each(function() {
          configFileList.push($(this).attr('href'));
      });

      var dropdownContainer = $('.right-column');
      var dropdown = $('<div class="dropdown"></div>');
      var menu = $('<ul class="dropdown-menu"></ul>');
      var index = 0;
      configFileList.forEach(function(path) {
        var fileName = fileNameOnly(path);
        menu.append('<li><a href="#" class="menu-item" id='+ index +'>' + fileName + '</a></li>');
        index++;
      });

      dropdown.append('<button class="configs-btn btn btn-primary dropdown-toggle" type="button" data-' +
        'toggle="dropdown">Patterns <span class="caret"></span></button>');
      dropdown.append(menu);
      dropdownContainer.prepend(dropdown);

      $('.menu-item').click(function(e) {
        var index = Number(e.target.id);
        var path = configFileList[index];
        readTextFile(path, loadNewConwaysConfig);
        $('.config-title').text(fileNameOnly(path));
      });
    }
  });
}

function fileNameOnly(path) {
  return path.substring(path.lastIndexOf('/')+1, path.lastIndexOf('.'));
}

function loadNewConwaysConfig(text) {
  var result = parseConwaysConfig(text);

  var comments = result[0];
  var dimensions = result[1];
  var configGrid = result[2];

  var configWidth = dimensions[0];
  var configHeight = dimensions[1];

  copyConfigGridIntoGrid(configWidth, configHeight, configGrid, grid);

  displayComments(comments);
}

function displayComments(comments) {
  var commentText = "";

  comments.forEach(function(comment, i) {
    var prefix = '';
    if (i !== 0) {
      prefix = '<br>'
    }
    commentText += prefix + comment.substring(2);
  });

  $('.config-description-body').html(commentText);

  //The column displaying comment text may resize here, so
  //we need to update the size of the center column too
  updateCenterColumnSize();
}

function copyConfigGridIntoGrid(configWidth, configHeight, configGrid, grid) {
  //Used to center the config grid over our grid (since they may be different sizes)
  var xOffset = Math.floor((ROW_SIZE - configWidth)/2);
  var yOffset = Math.floor((COL_SIZE - configHeight)/2);

  for (var i = 0; i < COL_SIZE; i++) {
    var row = [];

    var configRowIndex = i - yOffset;
    var configRow = null;

    if (configRowIndex >= 0 && configRowIndex < configHeight) {
      configRow = configGrid[configRowIndex];
    }

    for (var j = 0; j < ROW_SIZE; j++) {

      var configIndex = j - xOffset;
      var val = 0;

      if (configRow != null && configIndex >= 0 && configIndex < configWidth) {
        val = configRow[configIndex];
      }

      //Each cell in the grid holds an arry of data.
      row[j] = [val,val,0,0];
    }

    grid[i] = row;
  }

  updateDataTextureFromGrid(grid);
}

//This is for 'dbLife (*.L)' files, as described here: http://psoup.math.wisc.edu/mcell/ca_files_formats.html
function parseConwaysConfig(text) {
  var lines = text.match(/[^\r\n]+/g);
  var comments = [];
  var dimensions = [];
  var gridText = "";
  var gridData;
  
  lines.forEach(function(line) {
    if (line.startsWith('#')) { //comments
      comments.push(line);
    } else if (line.toLowerCase().startsWith("x")) { //dimensions

      var noWhiteSpaceLine = line.replace(/\s/g,'');
      var xAndY = noWhiteSpaceLine.split(",");
      var x = xAndY[0].split("=")[1];
      var y = xAndY[1].split("=")[1];
      dimensions.push(Number(x));
      dimensions.push(Number(y));

    } else { //grid data (actual info about whether cells are live or dead)
      gridText += line;
    }
  });

  gridData = parseGridText(gridText, dimensions);

  return [comments, dimensions, gridData];
}

function parseGridText(text, dimensions) {
  var textRows = text.split("$");
  var width = dimensions[0];
  var height = dimensions[1];
  var grid = new Array(height);
  var gridRowIndex = 0;
  for (var i = 0; i < grid.length; i++) {
    grid[i] = new Array(width);
  }

  for (var j = 0; j < textRows.length; j++) {
    var textRow = textRows[j];
    var inNumChunk = false;
    var inBOChunk = false;
    var numChunk = "";
    var boChunk = "";
    var chunks = [];

    for (var i = 0; i < textRow.length; i++) {
      var char = textRow[i];

      if (char === 'o' || char === 'b') { //Live cell or dead cell
        if (inBOChunk) {
          boChunk += char;
        } else {
          boChunk = char;
        }

        inBOChunk = true;

        if (inNumChunk) {
          chunks.push(Number(numChunk));
          inNumChunk = false;
        }

        if (i === textRow.length-1 || textRow[i+1] === "!") {
          chunks.push(boChunk);
        }
      } else if (!isNaN(char)) { //It's a number

        if (inNumChunk) {
          numChunk += char;
        } else {
          numChunk = char;
        }

        inNumChunk = true;

        if (inBOChunk) {
          chunks.push(boChunk);
          inBOChunk = false;
        }

        if (i === textRow.length-1 || textRow[i+1] === "!") {
          chunks.push(numChunk);
        }
      } else if (char !== "!") { // "!" indicates the end of the data
        console.log("ERROR: unexpected character in config file grid data: ", char);
      }
    }

    var blankRowsToAdd = fillRow(grid[gridRowIndex], chunks, width);
    gridRowIndex++;
    for (var i = 0; i < blankRowsToAdd; i++) {
      fillRow(grid[gridRowIndex], [], width);
      gridRowIndex++;
    }
  }

  
  //Add empty rows for the difference between specified
  //grid height and the actual data provided
  for (var i = gridRowIndex; i < height; i++) {
    fillRow(grid[i], [], width);
  }

  return grid;
}

function fillRow(row, chunks, rowSize) {
  var rowIndex = 0;
  var tagCount = 1;
  var blankRowsToAdd = 0;

  chunks.forEach(function(chunk, chunkIndex) {

    if (!isNaN(chunk)) { //It's a number
      if (chunkIndex === chunks.length-1) {
        //We subtract one since the chunk actually says how many lines
        //to move down, not how many blank rows to insert—and we always
        //want to move down one line.
        blankRowsToAdd = chunk - 1;
      }
      tagCount = chunk;
    } else {
      for (var i = 0; i < chunk.length; i++) {
        var char = chunk.charAt(i);

        //Convert b and o to 0 and 1
        if (char === 'b') {
          char = 0;
        } else if (char === 'o') {
          char = 1;
        }

        if (i === 0) {
          for (var j = 0; j < tagCount; j++) {
            row[rowIndex] = char;
            rowIndex++;
          }
        } else {
          row[rowIndex] = char;
          rowIndex++;
        }
      }
      tagCount = 1;
    }
  });

  //Fill in the ends of rows with zeros
  for (var i = rowIndex; i < rowSize; i++) {
    row[i] = 0;
  }

  return blankRowsToAdd;
}

function readTextFile(file, completion)
{
  var rawFile = new XMLHttpRequest();
  rawFile.open("GET", file, true);
  rawFile.onreadystatechange = function ()
  {
    if(rawFile.readyState === 4)
    {
      if(rawFile.status === 200 || rawFile.status == 0)
      {
        var allText = rawFile.responseText;

        completion(allText);
      }
    }
  }
  rawFile.send(null);
}

function update(timestamp) {
  stats.begin();

  var delta = clock.getDelta();
  var deltaMillis = delta*1000;

  if (pauseAtNextStep) {
    pauseDelayRemaining -= deltaMillis;

    if (pauseDelayRemaining <= 0) {
      pauseAtNextStep = false;
      pause();
    }
  }
  
  if (playing) {
    updateGame(deltaMillis);
  }

  controls.update( delta );
  if ( camera.position.y < 0 ) camera.position.y = 0;
  if (material) {
    material.uniforms.iResolution.value = new THREE.Vector2( canvas.width, canvas.height );
    material.uniforms.cameraPos.value = camera.getWorldPosition();
    material.uniforms.cameraDir.value = camera.getWorldDirection();
    material.uniforms.stepCompletion.value = stepCompletion;
    material.uniforms.mousePos.value = mousePos;
  }

  render (delta)
}

function render(delta) {
  if (material) {

    //In edit mode we make two rendering passes. The first one renders
    //the scene as usual, the second renders to a one pixel texture
    //which, after the pass, will contain the cell index which the
    //cursor is presently hovering over. The same shader is used,
    //but the uniform 'pickPass' causes it to behave differently
    //on this other pass.
    if (editModeActive) {
      material.uniforms.pickPass.value = false;
      renderer.render(scene, dummyCamera);
      material.uniforms.pickPass.value = true;
      renderer.render(scene, dummyCamera, renderTarget);

      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixelData);
      hoverCell.x = pixelData[0];
      hoverCell.y = pixelData[1];
      material.uniforms.hoverCell.value = hoverCell;
    } else {
      hoverCell.x = -99999;
      hoverCell.y = -99999;
      material.uniforms.pickPass.value = false;
      material.uniforms.hoverCell.value = hoverCell;
      renderer.render(scene, dummyCamera);
    }
  }

  stats.end();
  requestAnimationFrame( update );
}

function updateGame(deltaMillis) {
  timeSinceGameUpdate += deltaMillis;

  if (timeSinceGameUpdate > stepTime) {
    stepConwaysGame(grid);
    timeSinceGameUpdate = 0;
  }

  calcStepCompletion();
  updateDataTextureFromGrid(grid);
}

function calcStepCompletion() {
  stepCompletion = sinEase(timeSinceGameUpdate / stepTime, 0, 1);
}

var timeoutEvent;

function updateCenterColumnSize(e) {
  doResize();

  clearTimeout(timeoutEvent);
  timeoutEvent = setTimeout(doResize, 500);
}

function doResize() {
  var win = $(window);
  var centerColumn = $('.center-column');
  var canvas = $('#canvas');
  var controlBar = $('.control-bar');

  var controlBarHeight = 40;
  var freeVerticalSpace = 100;
  var columnHeight = win.height() - freeVerticalSpace;
  var width = centerColumn.width();
  var canvasHeight = columnHeight - controlBarHeight;

  centerColumn.css('height', columnHeight);
  canvas.css('height', canvasHeight)
  canvas.css('width', width);
  controlBar.css('height', controlBarHeight);
  controlBar.css('width', width);

  //There is more complexity in this resize function than it seems like
  //needs to be, because this 'setSize' function must be called in order to
  //update properties of the threejs renderer—but it also updates the canvas
  //component size (which we would prefer to be resized automatically through CSS).
  //Flexbox is resizing the canvas' container, and we want the width of the canvas
  //to match the container width—but there is some timing issue or something with
  //retreiving the width (which is why we use a delay in 'updateCenterColumnSize'). The most
  //this has done is mitigate the issue; the layout remains imperfect.
  renderer.setSize(width, canvasHeight);
}

function loadShader(src, type) {
  $.ajax({
      url: src,
      dataType: 'text',
      context: {
          type: type
      },
      complete: processShader
  });
}

function processShader(jqXHR, textStatus, x, y) {
  shaders[this.type] = jqXHR.responseText;
  shadersToLoad--;

  if (shadersToLoad === 0) {
    shadersFinishedLoading();
  }
}

function doConditionalLayoutMods() {
  if (isMobile() || !Detector.webgl) {
    $('body').css('align-items', 'center');
    $('.main-container').remove();
    var note = $('<span class="note"></span>');
    note.text('(Only a video is displayed since you are on mobile or have no WebGL support—otherwise you\'d see the app here.)');
    $('.title-block').after(note);
    var video = $('<div style=""><iframe src="https://www.youtube.com/embed/oCTmNURs8xk?ecver=2" frameborder="0" style="" allowfullscreen></iframe></div>');
    video.css('margin-top', '10px');
    $('.title-block').after(video);
    $('.subtitle').remove();

    if (isMobile()) {
      $('.writeup').removeClass('writeup').addClass('writeup-mobile');
    }

  } else { //Not mobile and we have webgl

    $('.title-block').css('margin-bottom', '-10px');
    $('.center-column').prepend($('<canvas id="canvas" tabindex=0></canvas>'));
    initThreejs();
    updateCenterColumnSize();
    window.addEventListener( 'resize', updateCenterColumnSize );

    //Load an initial pattern
    var path = './configs/BlockPuffer.l';
    readTextFile(path, loadNewConwaysConfig);
    $('.config-title').text(fileNameOnly(path));

    setUpEditModeEvents();

    update();
  }
}

var itIsMobile = null;
function isMobile() {
  if (itIsMobile != null) {
    return itIsMobile;
  }

  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  itIsMobile = check;
  return itIsMobile;
}