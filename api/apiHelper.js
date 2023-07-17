import PDFParser from 'pdf2json'
import fs from 'fs'
import stream from 'stream'
import crypto from 'crypto'
import * as cheerio from 'cheerio'
import * as XLSX from 'xlsx/xlsx.mjs';
XLSX.set_fs(fs);
const excelFile = "./files/keg-list.xlsx"


const DOWNLOAD_PATH = './api/downloads'
const GENERATED_PATH = './api/generated'

const useRegex = input => {
    let regex = />(.*?)<\/span>/i
    return regex.exec(input)
}
const testRegex = input => {
    let regex = />(.*?)<\/span>/i
    return regex.test(input)
}




const downloadLaRosePDF = async () => {

    if (fs.existsSync(`${DOWNLOAD_PATH}/LaRose.pdf`)) fs.unlinkSync(`${DOWNLOAD_PATH}/LaRose.pdf`)

    const res = await fetch('https://houseoflarose.com/www/files/pdf/LaRose%20Retail%20Window%20Pricebook.pdf')
        .catch(err => {
            console.log('error occured', err)
        })
    const fileStream = fs.createWriteStream(`${DOWNLOAD_PATH}/LaRose.pdf`, { flags: 'wx' });
    return await stream.promises.finished(stream.Readable.fromWeb(res.body).pipe(fileStream));


}

const fetchSuperioBeers = async (req, res) => {
    const data = await downloadSuperior()
    res.send(data)
}

const downloadSuperior = async () => {
    try {
        const heidelbergList = await fetch('https://superiorbeveragegroup.com/resources/keg-sales/northeast-ohio/summit/')
            .then(res => res.text())
            .catch(err => {
                console.log('error occured', err)
            })

        const $ = cheerio.load(heidelbergList);
        const kegListTable = $('#keg_pricing_table');
        if (kegListTable.length === 0) return {}

        const kegList = [];
        kegListTable.find('tbody tr').each((index, element) => {
            const row = {};
            $(element)
                .find('td')
                .each((i, el) => {
                    row[`column${i}`] = $(el).text().trim();
                });
            kegList.push(row);
        });

        const kegListBeers = kegList?.filter(beer => !!beer?.column7?.length).map(beer => {
            return {
                "sku": null,
                "name": beer.column0,
                "price": Number(beer?.column7?.replace("$", "")),
                "hash": crypto.createHash('md5').update(beer.column0).digest("hex"),
                "abv": beer?.column2,
                "location": "superior"
            }
        })
        fs.writeFileSync(
            `${GENERATED_PATH}/superiorbeveragegroup.json`,
            JSON.stringify(kegListBeers, null, 2),
            {
                encoding: 'utf8',
                flag: 'w',
                mode: 0o666,
            },
            () => { }
        )
        return kegListBeers
    } catch (error) {
        console.error(error);
        return {}
    }
}

const loadAndParseLaRosePDF = async () => {
    const pdfParser = new PDFParser()


    pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError))
    pdfParser.on('pdfParser_dataReady', pdfData => {
        const stack = pdfData['Pages'].slice(3, pdfData['Pages'].length).map(tac => {
            let line = tac['Texts']
                .filter(line => !!line['R'])
                .filter(line => !!line['R'].at(0)['T'])
                .map((line, i, newmap) => {
                    if (line['R'].at(0)['T']?.includes('1%2F6%20Barrel')) {
                        const sku = newmap.at(i + 1)['R'].at(0)['T']
                        const name = decodeURIComponent(line['R'].at(0)['T'])
                        const price = decodeURIComponent(newmap.at(i + 2)['R'].at(0)['T'])
                        return {
                            sku,
                            name,
                            price: Number(price.replace("$", "")),
                            "hash": crypto.createHash('md5').update(name).digest("hex"),
                            type: null,
                            abv: null,
                            location: "larose",
                        }
                    }
                })
                .filter(i => i)
            return line
        })

        fs.writeFileSync(
            `${GENERATED_PATH}/larose.json`,
            JSON.stringify(stack.flat(), null, 2),
            {
                encoding: 'utf8',
                flag: 'w',
                mode: 0o666,
            },
            () => { }
        )

    })

    return await pdfParser.loadPDF(`${DOWNLOAD_PATH}/LaRose.pdf`)

}


const combineFiles = async () => {
    const heidelberg = fs.readFileSync(`${GENERATED_PATH}/heidelberg.json`, 'utf8')
    const cavalier = fs.readFileSync(`${GENERATED_PATH}/cavalier.json`, 'utf8')
    const larose = fs.readFileSync(`${GENERATED_PATH}/larose.json`, 'utf8')
    const superiorbeveragegroup = fs.readFileSync(`${GENERATED_PATH}/superiorbeveragegroup.json`, 'utf8')
    let allbeers = [...JSON.parse(larose), ...JSON.parse(superiorbeveragegroup), ...JSON.parse(cavalier), ...JSON.parse(heidelberg)]
    // allbeers = allbeers.sort((a, b) => a?.price - b?.price)
    allbeers = allbeers.sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : (a.name.toUpperCase() > b.name.toUpperCase()) ? 1 : 0)
    fs.writeFileSync(
        `${GENERATED_PATH}/all.json`,
        JSON.stringify(allbeers, null, 2),
        {
            encoding: 'utf8',
            flag: 'w',
            mode: 0o666,
        },
        () => { }
    )
    return allbeers
}


const generateBeers = async (req, res) => {
    await downloadAndParseHeidelberg()
    await parseCavalier()
    await downloadLaRosePDF()
    await loadAndParseLaRosePDF()
    await downloadSuperior()
    await combineFiles()
    const allBeers = fs.readFileSync(`${GENERATED_PATH}/all.json`, 'utf8')
    res.send(JSON.parse(allBeers))
}

const mergeAllFiles = (req, res) => {
    const allBeers = combineFiles()
    res.send(allBeers)
}



const getAllBeers = (req, res) => {
    const allBeers = fs.readFileSync(`${GENERATED_PATH}/all.json`, 'utf8')
    res.send(JSON.parse(allBeers))
}


const getCavalier = async (req, res) => {
    const allCav = await parseCavalier()
    res.send(allCav)
}
const parseCavalier = async () => {

    var workbook = XLSX.readFile(excelFile);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    let brandHeading = []
    let beerStack = []
    jsonData.forEach((item, idx) => {
        if (Object.keys(item).length < 4) {
            brandHeading.push({ ...item, idx })
        }
    })
    brandHeading.forEach((item, idx) => {
        const nextStack = brandHeading?.at(idx + 1)
        const endOfBeerIdx = nextStack?.idx || jsonData.length
        item["nextStack"] = endOfBeerIdx
        item["beers"] = jsonData.slice(item.idx + 1, endOfBeerIdx)?.map(beer => {

            const beerName = `${item["Product Name"]} - ${beer["Product Name"]}`

            // https://stackoverflow.com/a/29494612
            beerStack.push({
                sku: null,
                name: beerName,
                price: Math.round(beer["Price"] * 1e2) / 1e2,
                "hash": crypto.createHash('md5').update(beerName).digest("hex"),
                type: beer["Style"] || null,
                abv: Math.round(beer['Alcohol By Volume'] * 100 * 1e3) / 1e3,
                location: "cavalier",
            })
            return beer
        })

    })

    fs.writeFileSync(
        `${GENERATED_PATH}/cavalier-all.json`,
        JSON.stringify(beerStack, null, 2),
        {
            encoding: 'utf8',
            flag: 'w',
            mode: 0o666,
        },
        () => { }
    )

    fs.writeFileSync(
        `${GENERATED_PATH}/cavalier.json`,
        JSON.stringify(beerStack.filter(beer => beer.name.includes('1/6')), null, 2),
        {
            encoding: 'utf8',
            flag: 'w',
            mode: 0o666,
        },
        () => { }
    )


    return beerStack;
}

const getHeidelberg = async (req, res) => {
    const hidelbergBeers = await downloadAndParseHeidelberg()
    res.send(hidelbergBeers)
}

const downloadAndParseHeidelberg = async () => {
    try {
        const heidelbergList = await fetch('https://heidelbergdistributing.com/locations/lorain/lorain-kegs/')
            .then(res => res.text())
            .catch(err => {
                console.log('error occured', err)
            })

        const $ = cheerio.load(heidelbergList);
        const kegListTable = $('.buy-kegs-table');
        if (kegListTable.length === 0) return {}

        const kegList = [];
        kegListTable.find('tr').each((index, element) => {
            const row = {};
            $(element)
                .find('td')
                .each((i, el) => {
                    row[`column${i}`] = $(el).text().trim();
                });
            kegList.push(row);
        });

        const kegListBeers = kegList?.filter(beer => beer?.column3 === "Available").map(beer => {
            return {
                "sku": null,
                "name": beer.column0,
                "price": null,
                "hash": crypto.createHash('md5').update(beer.column0).digest("hex"),
                "abv": null,
                "location": "heidelberg"
            }
        })
        fs.writeFileSync(
            `${GENERATED_PATH}/heidelberg.json`,
            JSON.stringify(kegListBeers, null, 2),
            {
                encoding: 'utf8',
                flag: 'w',
                mode: 0o666,
            },
            () => { }
        )
        return kegListBeers
    } catch (error) {
        console.error(error);
        return {}
    }
}


export { getHeidelberg, getCavalier, useRegex, generateBeers, testRegex, downloadLaRosePDF, downloadSuperior, loadAndParseLaRosePDF, combineFiles, getAllBeers, mergeAllFiles, fetchSuperioBeers }

