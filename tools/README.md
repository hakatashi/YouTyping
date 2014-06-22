UTX-tools
=========

# UTX-converter

Convert UTyping compiled fumen file and information file (optional) into YouTyping formatted UTX.

## Usage

    node utx-converter.js [Fumen File] ([Info File]) ([options...])

## Options

* `--output` `-o`: Specify the filename you want to write UTX file onto. Default is `stdout`.
* `--resource` `-r`: Set `<resource>` field of the UTX file to output. Default is none.
* `--note` `-n`: Set `<note>` field of the UTX file to output. Default is none.
* `--shift` `-s`: Shift the times of all notes by specified milliseconds. You may have to use equal sign to set minus value like `--shift=-10`. Default is zero.

`--help` and `-h` displays nothing. Sorry!
