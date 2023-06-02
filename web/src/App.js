import {
  Box,
  Center,
  Heading,
  Highlight,
  calc,
  Flex,
} from "@chakra-ui/react";
import { DataTable } from './components/table.js'
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useState } from "react";

const $lineHeight = "1.4375rem";



const columnHelper = createColumnHelper()

const columns = [
  columnHelper.accessor("name", {
    cell: (info) => info.getValue(),
    header: "name"
  }),
  columnHelper.accessor("price", {
    cell: (info) => info.getValue(),
    header: "price",
    meta: {
      isNumeric: true
    }
  }),
  columnHelper.accessor("location", {
    cell: (info) => info.getValue(),
    header: "location"
  })
];
const App = () => {
  const [beerData, setData] = useState([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState(null);

  useEffect(() => {
    fetch(`https://beer.sneakykiwi.com/all`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
      .then(res => res.json())
      .then((actualData) => {
        setData(actualData);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  console.log('beerData', beerData)

  return (
    <Box as="main">
      <Center textAlign="center">
        <Flex gap={$lineHeight} flexDir="column">
          <Heading
            as="h1"
            size="4xl"
            maxW="16ch"
            lineHeight={calc($lineHeight).multiply(4).toString()}
          >
            <Highlight
              query="Beer"
              styles={{ color: "purple.600", _dark: { color: "purple.400" } }}
            >
              Get More Beer
            </Highlight>
          </Heading>
          <DataTable columns={columns} data={beerData} />
        </Flex>
      </Center>
    </Box>
  );
}
export default App;



