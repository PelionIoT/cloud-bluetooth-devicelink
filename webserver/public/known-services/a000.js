(function () {
    function generate(m) {
        return {
            read: {
                "3347/0/5501": function (m) {
                    // read the first byte of the a001 characteristic
                    return m['a000']['a001'][0];
                },
                "3311/0/5706": function (m) {
                    // encode the rgb bytes into a uint32
                    var rgb = m['b000']['b001'];
                    return (rgb[2] << 16) + (rgb[1] << 8) + rgb[0];
                }
            },
            write: {
                "3311/0/5706": function (value, write) {
                    // read the value, and then retrieve the individual channels out of the color
                    var color = Number(value);

                    var red = color >> 16 & 0xff;
                    var green = color >> 8 & 0xff;
                    var blue = color & 0xff;

                    // write it back to the color characteristic
                    write('b000/b001', [red, green, blue]);
                }
            }
        };
    }

    window.knownServices.register('a000', 'Devicelink Test Service', generate);
})();
