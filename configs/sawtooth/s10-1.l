#C A sawtooth based on c/3 ships and puffers.
#C A period 24 c/3 puffer lays down a row of blocks.  A HWSS sweeps by
#C the blocks and deletes them.  When it reaches the period 24 spaceship,
#C it is converted into a forward glider.  The forward glider is turned
#C into a backward LWSS using a c/3 convoy.  The returning LWSS deletes
#C two gliders from a period 30 glider stream.  The glider stream gap
#C allows a new HWSS to escape from a period 120 HWSS gun to restart
#C the cycle.  This shows the sawtooth at the minimum population of 1704.
#C It reaches the minimum population again at generations 3760, 23760,
#C 122760, 617760, and so on.
#C David I. Bell, November 2002
x = 136, y = 312
92bo$91b3o$$88bobo3bobo$84b3ob4ob4ob3o$83bo7bobo7bo$84boo3b3ob3o3boo$
89boo3boo$90bo3bo$90bo3bo$85b3obbo3bobb3o$84boboboo5boobobo$85bo6bo6bo
$92bo$78boboo9bobo9boobo$73boobbooboobobo5bobo5bobobooboobboo$70boboo
bbo3bo4boo11boo4bo3bobboobo$69boboo6b5oboo3booboo3boob5o6boobo$68bo3b
3o7boboo3bobobobo3boobo7b3o3bo$69boobobb3o10boo5boo10b3obboboo$78bobo
3bobobob5obobobo3bobo$81boo4boobo3boboo4boo$$92bo$51boboob3o30b3ob3o
30b3oboobo$50booboo4boobo26bobobobo26boboo4booboo$49bobbobobbo3b3o24b
3o3b3o24b3o3bobbobobbo$50bo5bo3bo3bo22bo3bobo3bo22bo3bo3bo5bo$63boo4b
3o15bobobobobobo15b3o4boo$63boobboobo17b3o3b3o17boboobboo$64boo4boboo
4b3o8bo5bo8b3o4boobo4boo$69bobbobo6bo21bo6bobobbo$64boobobbobob3o4b5o
5bobo5b5o4b3obobobboboo$68bo5boboo3boboobo3booboo3boboobo3boobo5bo$74b
o4bobobobbo3bo3bo3bobbobobo4bo$78bo4booboo9booboo4bo$84boboboob3oboobo
bo$81boo4b11o4boo$89bo5bo$91bobo$90bobbo$91bo3$93boo$32b3o67boo9boo$
30boo3bo63booboo9booboo$29bo3bobbo40boo20boo3bo7bo3boo$29bo6boobo36boo
11boo4b3obbo15bobb3o$32b3obooboo37bo10boo4boobb3o5b3o5b3obboo$29b3o3bo
boobbo53b3o9b3o9b3o$28boo66bo9bo3bo9bo$40bo56bobbo15bobbo$32b3o4boo55b
ooboo4bo5bo4booboo$33boo3b3o59b7obob7o$33boobboo60bobobo9bobobo$36b3o$
28boo4bobbo$25booboo6bo$22b4obbobo$21bo4bo4bo$22boo7bo$31bo$27b3o$26bo
$27boboo$31bo$27boo$21b3obbo3bo$9bo11b3o5bo$5b3ob3o8bo3bobbo$4bo6boo
11bobbo$5boo3bobbo3bo9boo$15b4o7b3o$15bo3bo7boo$13bobbobo$14bo$$14boo$
13bobbo$13boboo$12boobobo$11bobobo$10booboboboo$13bobo$10boobobobboo$
15boo3bo$11bo4boo$11bo4bobobo$13bobbo7$11bo$7b3ob3o$6bo6boo$7boo3bobbo
3bo$17b4o$17bo3bo36boo$15bobbobo37booboo$16bo40boboboo$56b3obboo$52b3o
bobob3o$51bo11boo$52bobobbo$61bobbo$52boo5bo$51bobbo3boo$55bo$55bo3bo$
55bo3bo$56boo9$61b3o$60bo3boobo$60bobo3b3o$59boo4bo3bo$58b3o7bo$60bobo
$62boo$60bo3bo$60bo$60boobo$63bo4bo$61b3o3bobo$66bo3bo$34b3obo23bo3bob
oo$35booboo23boo$33b3obobbo$29b3oboo4bo21bobbo$28bo33bobo$24bo4bobbobb
3o$14boboo6boo6bo3b3o$13boobooboo3boboobb5o4bo$12bobbobobbo3bobbobo3bo
$13bo5boo3b4o6boobobo$22boobo$22bo$22bo7$24boo$23boobo$23boobo$21b3ob
oo3bo$16bo3bo4bobb3ob3o$15b4o4b3obboo5bo$14bo3bo9boobobbo$15bobobbo4b
oo4bo$19bo9bob3o$14bo16bo3bo$14b3obbo6bo3bobobbo$3boo4b5o4bobob3ob3o6b
oo$ooboo3b3obbo4bobo3boobbo3booboo$oo3bo4b5obobo3boo12bo$obobbobbo3boo
12bobboobobbo$3bob4o16boobboobbo$25boboo$30bo$26b4o$27boo44boobo$70boo
booboo$70bobbobobbo$64boo4boo5bo$43boo19booboo$43boo18bo3boo$67boo$$
67boo$67boo$66bobbo$11b3o6boob3o17bo21bobobo$7boboo3bo5boo4boo14b3o22b
obo$6b3o3bobo4bobbobo3bo13b3o19booboboboo$5bo3bo4boo10b3obb3o33boboboo
$6bo7b3o11b3obobo5boo3boo16bobobobo$12bobo13bo4bo6boo3boo16bo3bobbo$
11boo16boo32boobboob3o$10bo3bo48bo$14bo27boo22boobbo$11boboo27bobo20bo
$6bo4bo29bobboo$5bobo3b3o29boo$4bo3bo34boo$5boobo3bo31bo$10boo$38bo5bo
$10bobbo24bo5bo$10bobo26bo3bo6bo$40b3o5bobo$49boo5$57bo$58bo$56b3o$41b
oo$41boo4$65bo$63bobo$64boo5$72bo$73bo$71b3o6$80bo$78bobo$79boo5$87bo$
88bo$86b3o3$91boo$91bobo$93bo$93boo4$90boo$91bo$77boo12bobo5boo$77bo
14boo5bobo$66bo8bobo24bo11bobo$64bobo8boo22bobbo10bobbo4bo$55bo7bobo
36bo9boo5boo$54boo6bobbo25boo6bobo8boo3bo8boo$53boo4boobbobo23bobbo6b
oo11boo10boo$43boo7b3o4boo3bobo9boo35bobbo$43boo8boo4boo5bo9boo11bobbo
11bo9bobo$54boo34bobbo$55bo35bobo6boo$75boboo13bo7boo$67boo6bobo$67boo
7bo14boo$76boo13boobboo$76boo$76boo42bo$61b3o43boobboo6b4o$50bo12bo38b
obobbob4o5boobobo3boo$50b4o8bo37bo3bo3boboo5b3obobbobboo$40boo9b4o10b
oo33bo12bo4boobobo$40boo9bobbo9bobo32bo4bo14b4o$45bo5b4o8b3o34bo19bo$
45bo4b4o8b3o19bo10boo3bo3bo$50bo12b3o17b3o8bobo5bobo$64bobo5boo8boobo
8bo$65boo5bobo7b3o8boo$74bo7b3o$74boo6b3o5boo$83boo6bo$74boo15bobo5boo
$74bo17boo5bobbo$65boo5bobo28bo9bobo$64bobo5boo29bo7bo3bo$49bobo11bo
39bo7bo$44bo4bobbo10bobbo32bobbo7bo4bo8boo$45boo5boo9bo35boo10bo12boo$
40boo8bo3boo8bobo44bo3bo$40boo10boo11boo35bobo8bobo$49bobbo8bo40boo$
49bobo10boo24boo13bo$61boo25bobbo$76boo20bo$75bobbo9bobbo5boo$75bo11bo
bbo6bobo$66boo7bo11bobo$67boo6boboo9bo21boo$66bo10boo31bobo$55boo31boo
10bo4boo6bo7boo$54bo3bo29boo9bobobbobbobbobbo7boo$43boo8bo5bo7bo8boo
21boobob3o6bo$43boo8bo3boboo4bobo8boo21booboo6bobo$53bo5bo3boo34boobo
7boo$54bo3bo4boo24boo8bobo$55boo6boo23bobo9bo$65bobo7boo11bo$67bo7bobo
9boo$77bo$77boo!
