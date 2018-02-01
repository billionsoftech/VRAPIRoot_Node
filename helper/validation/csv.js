/**
 * Created by titu on 10/24/16.
 */
const promise = require('bluebird');
const fs = require('fs');
const csv = require('fast-csv');
const _ = require('lodash');
const babyparse = require('babyparse');
const globalConfig = require('../../config/global');

let readFromFileAndRemoveDupes = (filePath, header) => {
    console.log('readFromFileAndRemoveDupes: CSV');
    let containsHeader = false;

    return new promise((resolve, reject) => {

        if (_.isObject(header) && header.header === true) {
            containsHeader = true;
        }
        console.log('MEMORY USE BEFORE FILE READ: ', process.memoryUsage());
        babyparse.parseFiles(filePath, {
            header: containsHeader,
            complete: (results) => {
                resolve(onParseComplete(results, header));
            },
            error: (err, file, inputElem, reason) => {
                reject(err);
            },
        });

        //readStream.pipe(parser);
    });
};

let onParseComplete = (results, header) => {
    let csvData = {};
    let uniqueData = [];
    let containsHeader = false;
    let emailIndex = header.emailIndex || 0;
    let emailColumnHeader = null;
    let email = null;
    let duplicateData = [];

    if (_.isObject(header) && header.header === true) {
        containsHeader = true;
    }

    if (results.data && results.data.length) {

        /*
         Detect that if the data is in form of object or in array

         if in Object then that is a key/value pair and confirms
         to be a file parsed having header.

         if in Array then a file which doesn't have header
         */

        console.log('MEMORY USE: ', process.memoryUsage());
        if (containsHeader) { // So there is a header
            //determine the email field name/column header for email
            for (var key in results.data[0]) {
                if (_.includes(globalConfig.emailKeyNames, key.toLowerCase())) {
                    emailColumnHeader = key;
                    break;
                }
            }
            results.data = _.remove(results.data, function (record) {
                return !!record[emailColumnHeader];
            });
            results.data.forEach(function (record) {
                email = record[emailColumnHeader];

                if (email) {
                    record[emailColumnHeader] = email = _.toLower(email);
                    if(!csvData[email]) {
                        csvData[email] = true;
                        uniqueData.push(record);
                    }
                    else {
                        duplicateData.push(email);
                    }
                }
            });
        }
        else { // No header provided
            results.data = _.remove(results.data, function (record) {
                return !!record[emailIndex];
            });
            results.data.forEach(function (record) {
                email = record[emailIndex];

                if (record.length && email) {
                    record[emailIndex] = email = _.toLower(email);
                    if(!csvData[email]) {
                        csvData[email] = true;
                        uniqueData.push(record);
                    }
                    else {
                        duplicateData.push(email);
                    }
                }
            });
        }

        let report = {
            'totalRecords': results.data.length,
            'duplicate': (results.data.length - uniqueData.length),
            saveReports: [{
                reportName: 'Duplicate',
                data: duplicateData
            }]
        };


        return {
            data: uniqueData,
            delimiter: results.data.delimiter,
            report: report
        };
    }
    else {
        return [];
    }
};


let save = (data, filePath, fileName, header, delimiter) => {
    return new promise(function (resolve, reject) {
        let writeStream = fs.createWriteStream(filePath + '/' + fileName + '.csv');
        let containsHeader = false;

        if (_.isObject(header) && header.header === true) {
            containsHeader = true;
        }
        writeStream.on('error', reject);
        writeStream.on('finish', function () {
            resolve();
        });
        csv.write(data, {
            headers: containsHeader,
            delimiter: delimiter
        }).pipe(writeStream);
    });
};

let parseFiles = function ParseFiles(_input, _config)
{
    if (Array.isArray(_input)) {
        var results = [];
        _input.forEach(function(input) {
            if(typeof input === 'object')
                results.push(ParseFiles(input.file, input.config));
            else
                results.push(ParseFiles(input, _config));
        });
        return results;
    } else {
        var results = {
            data: [],
            errors: []
        };
        if ((/(\.csv|\.txt|\.tsv|\.text)$/).test(_input)) {
            try {
                /*var contents = fs.readFileSync(_input).toString();
                return this.parse(contents, _config);*/
                var me = this;

                fs.readFile(_input, 'UTF-8', function (err, contents) {
                    if(err) {
                        console.log(err);
                        results.errors.push(err);
                        return results;
                    }
                    else {
                        console.log('file contents read completed within CSV handler');
                        me.parse(contents, _config);
                    }

                });
            } catch (err) {
                results.errors.push(err);
                return results;
            }
        } else {
            results.errors.push({
                type: '',
                code: '',
                message: 'Unsupported file type.',
                row: ''
            });
            return results;
        }
    }
};
parseFiles.bind(babyparse);
babyparse.parseFiles = parseFiles;

module.exports = {
    readFromFileAndRemoveDupes: readFromFileAndRemoveDupes,
    onParseComplete: onParseComplete,
    save: save
};