import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { getSharedWelcomeMessage } from '@repo/shared';

export default function App() {
  const message = getSharedWelcomeMessage('Lebensordner')

  return (
    <View style={styles.container}>
      <Text>{message}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
